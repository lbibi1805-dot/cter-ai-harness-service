import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { AIInvocationService } from '../../ai';
import {
  AgentFallbackReason,
  AnswerMode,
  type Answerer,
  type AnswerRequest,
  type AnswerResult,
} from '../domain';
import { AgentCapability } from './interfaces/answer.interface';
import { toAgentAnswer } from './helpers/answer.helper';

/**
 * Chooses how to answer. Agent mode is opt-in per request and always falls
 * back to the single-shot path, so an agent problem never loses an answer.
 */
export class AnswerService implements Answerer {
  constructor(
    private readonly singleShot: AIInvocationService,
    private readonly agent: AgentCapability | null,
  ) {}

  async answer(request: AnswerRequest): Promise<AnswerResult> {
    if (request.mode !== AnswerMode.AGENT) {
      return { ...(await this.singleShot.answer(request)), mode: AnswerMode.SINGLE_SHOT };
    }
    if (!this.agent) return this.fallback(request, AgentFallbackReason.AGENT_DISABLED);

    const resolution = await this.agent.createModel(request.provider, request.model);
    if (!resolution.supported) return this.fallback(request, resolution.reason);

    const { runner, systemPrompt } = this.agent;
    const run = await attempt(() => runner.run({ model: resolution.model, systemPrompt, content: request.content, label: request.label }));
    if (!run.ok) {
      logger.warn(`[agent] ${request.label} failed (${errorMessage(run.error)}) — falling back to single-shot`);
      return this.fallback(request, AgentFallbackReason.AGENT_FAILED);
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
