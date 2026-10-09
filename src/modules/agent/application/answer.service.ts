import type { AIInvocationService } from '../../ai';
import { errorMessage } from '../../../shared/resilience';
import { logger } from '../../../utils/logger';
import {
  AgentFallbackReason,
  AnswerMode,
  type Answerer,
  type AnswerRequest,
  type AnswerResult,
  type ToolCallingModelFactory,
} from '../domain';
import type { AgentRunner } from './agentRunner.service';

export interface AgentCapability {
  runner: AgentRunner;
  createModel: ToolCallingModelFactory;
  systemPrompt: string;
}

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
    const model = this.agent.createModel(request.provider, request.model);
    if (!model) {
      const reason = request.provider === 'openai' ? AgentFallbackReason.UNSUPPORTED_MODEL : AgentFallbackReason.UNSUPPORTED_PROVIDER;
      return this.fallback(request, reason);
    }

    try {
      const run = await this.agent.runner.run({ model, systemPrompt: this.agent.systemPrompt, content: request.content, label: request.label });
      return {
        text: run.text,
        model: run.model,
        attempts: run.modelCalls,
        mode: AnswerMode.AGENT,
        agent: { stopReason: run.stopReason, toolCalls: run.steps.length, sourcesRead: run.sourcesRead, usage: run.usage },
      };
    } catch (err) {
      logger.info(`[agent] ${request.label} failed (${errorMessage(err)}) — falling back to single-shot`);
      return this.fallback(request, AgentFallbackReason.AGENT_FAILED);
    }
  }

  private async fallback(request: AnswerRequest, reason: AgentFallbackReason): Promise<AnswerResult> {
    if (reason !== AgentFallbackReason.AGENT_FAILED) {
      logger.info(`[agent] ${request.label} — agent mode not available (${reason}) for ${request.provider}/${request.model}, answering single-shot`);
    }
    return { ...(await this.singleShot.answer(request)), mode: AnswerMode.SINGLE_SHOT, fallbackReason: reason };
  }
}
