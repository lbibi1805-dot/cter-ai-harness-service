import { logger } from '../../../shared/logging/logger';
import type { AuxResolveRequest } from '../../context';
import { AUX_INTENT_MIN_CONFIDENCE } from '../domain/constants/routing.constants';
import { IntentSource, RequestIntent } from '../domain/enums/routing.enums';
import { classifyIntent, fallbackIntent } from '../domain/intentRules';
import type { IntentDecision, IntentInput } from '../domain/interfaces/routing.interface';
import { AuxRouterSession } from './auxRouter.service';
import { ROUTER_ESSAY_INSTRUCTIONS, ROUTER_ESSAY_SKILL_ID } from './constants/auxRouter.constants';
import type { RouterAuxModel, RoutingSettings } from './interfaces/auxRouter.interface';

/**
 * Intent Router (note 05 §2): rules first (0 ms, no model); the aux model only when the rules cannot
 * decide — through the request's AuxRouterSession, whose single call also answers the artifact refs.
 */
export class IntentRouter {
  constructor(
    private readonly model: RouterAuxModel | null,
    private readonly settings: RoutingSettings,
  ) {}

  /** True when an aux model is configured (rules-only otherwise). */
  get auxEnabled(): boolean {
    return this.model !== null;
  }

  /** A per-request session: pass it to the artifact resolver too, so intent + refs = one call. Null without an aux model. */
  session(input: Pick<IntentInput, 'slash' | 'imageCount' | 'designCount'>): AuxRouterSession | null {
    return this.model ? new AuxRouterSession(this.model, { slash: input.slash, imageCount: input.imageCount, designCount: input.designCount }, this.settings.timeoutMs) : null;
  }

  /**
   * Essay Mode: a session whose one call also returns the essay analysis block (note 15 step ①). Pass it
   * to the chat turn as its artifact resolver and to the essay pipeline. `timeoutMs`: the essay analysis
   * budget (never below the router's own). Null without an aux model.
   */
  essaySession(input: Pick<IntentInput, 'imageCount' | 'designCount'>, timeoutMs: number): AuxRouterSession | null {
    if (!this.model) return null;
    const instructions = this.settings.skills?.(ROUTER_ESSAY_SKILL_ID) ?? ROUTER_ESSAY_INSTRUCTIONS;
    return new AuxRouterSession(
      this.model,
      { slash: false, imageCount: input.imageCount, designCount: input.designCount, essay: true },
      Math.max(this.settings.timeoutMs, timeoutMs),
      instructions,
    );
  }

  async route(input: IntentInput, session: AuxRouterSession | null, auxRequest: AuxResolveRequest): Promise<IntentDecision> {
    const ruled = classifyIntent(input);
    if (ruled) return ruled;
    const reply = session ? await session.ask(auxRequest) : null;
    if (reply?.intent && reply.confidence >= AUX_INTENT_MIN_CONFIDENCE) {
      // /c4 is never plain Q&A: the aux model saying "qa" means "draw".
      const intent = input.slash && reply.intent === RequestIntent.QA ? RequestIntent.C4_GENERATE : reply.intent;
      return { intent, confidence: reply.confidence, source: IntentSource.AUX, ...(reply.reason ? { reason: reply.reason } : {}) };
    }
    const fallback = fallbackIntent(input);
    logger.info(`[routing] rules undecided, aux ${reply ? `unsure (${reply.confidence})` : 'unavailable'} — ${fallback.intent}`);
    return fallback;
  }
}
