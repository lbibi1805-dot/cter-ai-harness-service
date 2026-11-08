import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { extractJsonObject } from '../../../shared/text';
import type { AuxResolveReply, AuxResolveRequest, AuxResolver } from '../../context';
import { ArtifactKind } from '../../conversation-store';
import { RequestIntent } from '../domain/enums/routing.enums';
import {
  ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS,
  ROUTER_AUX_LABEL,
  ROUTER_AUX_MAX_OUTPUT_TOKENS,
  ROUTER_AUX_SYSTEM,
  ROUTER_ESSAY_INSTRUCTIONS,
} from './constants/auxRouter.constants';
import type { AuxEssayBlock, AuxRouteHints, AuxRouteReply, RouterAuxModel } from './interfaces/auxRouter.interface';

const INTENTS = new Set<string>(Object.values(RequestIntent));

function clamp01(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/** Validates the model's JSON: unknown intents become null, refs not in the registry are dropped. */
export function parseAuxRouteReply(answer: string, registryAliases: readonly string[]): AuxRouteReply | null {
  const json = extractJsonObject(answer);
  if (!json) return null;
  const known = new Set(registryAliases.map((a) => a.toUpperCase()));
  const intent = typeof json.intent === 'string' && INTENTS.has(json.intent.trim().toLowerCase()) ? (json.intent.trim().toLowerCase() as RequestIntent) : null;
  const refs = (Array.isArray(json.refs) ? json.refs : [])
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.trim().replace(/^\[|\]$/g, '').toUpperCase())
    .filter((r) => known.has(r));
  const essay = json.essay && typeof json.essay === 'object' && !Array.isArray(json.essay) ? (json.essay as Record<string, unknown>) : undefined;
  return {
    intent, confidence: clamp01(json.confidence), refs: [...new Set(refs)],
    ...(typeof json.reason === 'string' ? { reason: json.reason.slice(0, 120) } : {}),
    ...(essay ? { essay } : {}),
  };
}

function promptOf(request: AuxResolveRequest, hints: AuxRouteHints): string {
  const registry = request.registry.map((r) => `${r.alias} · ${r.kind} · ${r.owner ?? '-'} · turn ${r.turn ?? '-'} · ${r.label}`);
  return [
    `Request${hints.slash ? ' (sent with /c4)' : ''}: ${request.question || '(no text)'}`,
    `Images attached: ${hints.imageCount}. C4 designs already in the conversation: ${hints.designCount}.`,
    `Registry:\n${registry.length ? registry.join('\n') : '(empty)'}`,
    request.recentTurns.length ? `Recent turns:\n${request.recentTurns.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

/**
 * One request's combined aux call (note 05 §2 + 17 §3.3): the intent router and the artifact resolver
 * share it, so "intent + refs" costs at most ONE model call per request. Never throws: a model problem,
 * a timeout or an unusable answer is null (= the caller keeps its rule-based result).
 */
export class AuxRouterSession implements AuxResolver {
  private reply?: Promise<AuxRouteReply | null>;
  /** Model calls made by this session (0 or 1). */
  calls = 0;
  /** True when the call threw or timed out (null reply for another reason = unusable answer). */
  private failed = false;

  /**
   * `timeoutMs`: the call's budget. With `hints.essay` the essay caller's budget is used as is (the
   * artifact resolver stops waiting at its own timeout; the essay still gets the same pending answer).
   */
  constructor(
    private readonly model: RouterAuxModel,
    private readonly hints: AuxRouteHints,
    private readonly timeoutMs: number,
    private readonly essayInstructions: string = ROUTER_ESSAY_INSTRUCTIONS,
  ) {}

  /** The combined answer; the first caller's request is the one sent, later callers get the cached reply. */
  ask(request: AuxResolveRequest): Promise<AuxRouteReply | null> {
    this.reply ??= this.call(request);
    return this.reply;
  }

  /**
   * Essay Mode (note 15 step ①): the essay block of this request's combined answer. Sends the call when
   * the artifact resolver did not need it (a question-only request: empty registry, no turns).
   */
  async essayAnalysis(question: string): Promise<AuxEssayBlock> {
    const reply = await this.ask({ question, registry: [], recentTurns: [], timeoutMs: this.timeoutMs });
    return { failed: this.failed, block: reply?.essay ?? null };
  }

  async resolve(request: AuxResolveRequest): Promise<AuxResolveReply | null> {
    const reply = await this.ask(request);
    return reply ? { refs: reply.refs, confidence: reply.confidence, ...(reply.reason ? { reason: reply.reason } : {}) } : null;
  }

  private async call(request: AuxResolveRequest): Promise<AuxRouteReply | null> {
    this.calls++;
    try {
      const essay = !!this.hints.essay;
      const answer = await this.model.complete({
        system: essay ? `${ROUTER_AUX_SYSTEM}

${this.essayInstructions}` : ROUTER_AUX_SYSTEM,
        text: promptOf(request, this.hints),
        label: ROUTER_AUX_LABEL,
        timeoutMs: essay ? this.timeoutMs : Math.min(this.timeoutMs, request.timeoutMs || this.timeoutMs),
        maxOutputTokens: essay ? ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS : ROUTER_AUX_MAX_OUTPUT_TOKENS,
      });
      return parseAuxRouteReply(answer, request.registry.map((r) => r.alias));
    } catch (err) {
      this.failed = true;
      logger.warn(`[routing] aux call failed (${errorMessage(err)}) — keeping the rules' result`);
      return null;
    }
  }
}

/** Step ③ of the chat path's artifact resolver: a fresh session (= one combined call) per ambiguous question. */
export class AuxRouterResolver implements AuxResolver {
  constructor(private readonly model: RouterAuxModel, private readonly timeoutMs: number) {}

  resolve(request: AuxResolveRequest): Promise<AuxResolveReply | null> {
    return new AuxRouterSession(this.model, { slash: false, imageCount: 0, designCount: request.registry.filter((r) => r.kind === ArtifactKind.C4_SPEC).length }, this.timeoutMs).resolve(request);
  }
}
