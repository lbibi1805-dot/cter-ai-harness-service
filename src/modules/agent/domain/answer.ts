import type { AIAnswer, AIRequest } from '../../ai';
import type { AgentFallbackReason, AgentStopReason, AnswerMode } from './agent.enums';
import type { TokenUsage } from './agentRun';

export interface AnswerRequest extends AIRequest {
  /** Defaults to single-shot when absent. */
  mode?: AnswerMode;
}

export interface AgentAnswerDetails {
  stopReason: AgentStopReason;
  toolCalls: number;
  sourcesRead: string[];
  usage: TokenUsage;
}

export interface AnswerResult extends AIAnswer {
  /** Mode that actually produced the text. */
  mode?: AnswerMode;
  agent?: AgentAnswerDetails;
  /** Set when an agent request was answered single-shot. */
  fallbackReason?: AgentFallbackReason;
}

/**
 * What the polling jobs depend on. `AIInvocationService` satisfies it
 * structurally (single-shot only); `AnswerService` adds the agent mode.
 */
export interface Answerer {
  answer(request: AnswerRequest): Promise<AnswerResult>;
}
