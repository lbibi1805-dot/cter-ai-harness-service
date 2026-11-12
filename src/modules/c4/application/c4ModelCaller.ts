import { TimeoutError, UpstreamError } from '../../../shared/errors';
import { withTimeout } from '../../../shared/resilience';
import { extractJsonObject } from '../../../shared/text';
import type { PromptImage } from '../../ai';
import { MIN_TIME_FOR_RETRY_MS } from './constants/c4Sketch.constants';
import type { C4PromptBuilder } from './c4Prompts.builder';
import type { C4ModelCall, C4ModelGateway, C4RunContext } from './interfaces/c4Sketch.interface';

/** Model calls of one run under its deadline: every agent of the workflow goes through here. */
export class C4ModelCaller {
  constructor(
    private readonly model: C4ModelGateway,
    private readonly prompts: C4PromptBuilder,
    private readonly callTimeoutMs: number,
    private readonly now: () => number,
  ) {}

  timeLeft(ctx: C4RunContext): number {
    return ctx.deadline - this.now();
  }

  /** Asks for a JSON object; an unparseable answer gets one retry when time allows. */
  async askJson(ctx: C4RunContext, text: string, images: PromptImage[], step: string, systemPrompt?: string): Promise<Record<string, unknown>> {
    const first = extractJsonObject(await this.ask(ctx, text, images, step, systemPrompt));
    if (first) return first;
    if (this.timeLeft(ctx) < MIN_TIME_FOR_RETRY_MS) throw new UpstreamError(`${step}: model answer is not JSON`);
    const second = extractJsonObject(await this.ask(ctx, `${text}\n\n${this.prompts.jsonRetry()}`, images, `${step}-retry`, systemPrompt));
    if (!second) throw new UpstreamError(`${step}: model answer is not JSON`);
    return second;
  }

  ask(ctx: C4RunContext, text: string, images: PromptImage[], step: string, systemPrompt?: string): Promise<string> {
    const budget = this.budget(ctx, step);
    const call = this.model.ask(this.call(ctx, text, images, step, budget, systemPrompt));
    return withTimeout(call, budget, `${ctx.label}-${step}`);
  }

  /** A streamed answer (markdown); gateways without streaming deliver it as one delta. */
  async stream(ctx: C4RunContext, text: string, images: PromptImage[], step: string, systemPrompt: string, onDelta: (text: string) => void): Promise<string> {
    const budget = this.budget(ctx, step);
    const call = this.call(ctx, text, images, step, budget, systemPrompt);
    if (this.model.stream) return withTimeout(this.model.stream(call, onDelta), budget, `${ctx.label}-${step}`);
    const answer = await withTimeout(this.model.ask(call), budget, `${ctx.label}-${step}`);
    onDelta(answer);
    return answer;
  }

  private budget(ctx: C4RunContext, step: string): number {
    const budget = Math.min(this.callTimeoutMs, this.timeLeft(ctx));
    if (budget <= 0) throw new TimeoutError(`${step}: C4 deadline reached`);
    return budget;
  }

  /**
   * `deadlineAt` = this step's budget (C4_CALL_TIMEOUT_MS, within the run deadline): the AI module's
   * retries/fallback stop there instead of at the interactive CHAT_DEADLINE_MS.
   */
  private call(ctx: C4RunContext, text: string, images: PromptImage[], step: string, budgetMs: number, systemPrompt?: string): C4ModelCall {
    return {
      provider: ctx.provider, model: ctx.model, systemPrompt: systemPrompt ?? ctx.systemPrompt, text: this.prompts.userText(ctx.reference, text), images, label: `${ctx.label}-${step}`,
      deadlineAt: this.now() + budgetMs,
    };
  }
}
