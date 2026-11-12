import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { DEFAULT_CHAT_DEADLINE_MS, PromptCacheLayout, placeMemory, withReminder, type AIInvocationService } from '../../ai';
import {
  AgentFallbackReason,
  AnswerMode,
  type Answerer,
  type AnswerRequest,
  type AnswerResult,
} from '../domain';
import { AgentCapability } from './interfaces/answer.interface';
import { toAgentAnswer } from './helpers/answer.helper';
import { AGENT_FALLBACK_MIN_MS } from '../domain/constants/agent.constants';

/**
 * Chooses how to answer. Agent mode is opt-in per request and always falls
 * back to the single-shot path, so an agent problem never loses an answer.
 */
export class AnswerService implements Answerer {
  constructor(
    private readonly singleShot: AIInvocationService,
    private readonly agent: AgentCapability | null,
    private readonly now: () => number = Date.now,
    private readonly layout: PromptCacheLayout = PromptCacheLayout.V2,
  ) {}

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    if (request.mode !== AnswerMode.AGENT) {
      return { ...(await this.singleShot.answer(request)), mode: AnswerMode.SINGLE_SHOT };
    }
    if (!this.agent) return this.fallback(request, AgentFallbackReason.AGENT_DISABLED);

    const resolution = await this.agent.createModel(request.provider, request.model);
    if (!resolution.supported) return this.fallback(request, resolution.reason);

    const { runner, reminder } = this.agent;
    // Same layout rules as the single-shot preparer (note 18): V2 keeps the system prompt static; the reminder closes the user text.
    const placed = placeMemory(this.agent.systemPrompt, request.content, this.layout);
    const startedAt = this.now();
    const deadlineAt = request.deadlineAt ?? startedAt + Math.max(runner.maxDurationMs, this.singleShot.deadlineMs ?? DEFAULT_CHAT_DEADLINE_MS);
    const run = await attempt(() => runner.run({
      model: resolution.model,
      // Tool models take a plain system prompt + content: fold the context layers in here.
      systemPrompt: placed.systemPrompt,
      content: { ...request.content, textContent: withReminder(placed.textContent, reminder), memory: undefined, jitContext: undefined },
      label: request.label,
      stream: request.stream,
      extraTools: request.extraTools,
    }));
    if (!run.ok) {
      logger.warn(`[agent] ${request.label} failed (${errorMessage(run.error)}) — falling back to single-shot`);
      // Drop any agent text the client already shows: the single-shot answer replaces it from scratch.
      request.stream?.reset();
      // The fallback gets what is left of the request deadline (never less than AGENT_FALLBACK_MIN_MS), not a fresh one.
      return this.fallback({ ...request, deadlineAt: Math.max(deadlineAt, this.now() + AGENT_FALLBACK_MIN_MS) }, AgentFallbackReason.AGENT_FAILED);
    }
    return toAgentAnswer(run.value);
  }

  private async fallback(request: AnswerRequest, reason: AgentFallbackReason): Promise<AnswerResult> {
    if (reason !== AgentFallbackReason.AGENT_FAILED) {
      logger.info(`[agent] ${request.label} — agent mode not available (${reason}) for ${request.provider}/${request.model}, answering single-shot`);
    }
    return { ...(await this.singleShot.answer(request)), mode: AnswerMode.SINGLE_SHOT, fallbackReason: reason };
  }
}
