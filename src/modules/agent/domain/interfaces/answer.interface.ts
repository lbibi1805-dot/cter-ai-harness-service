import type { AIAnswer, AIRequest } from '../../../ai';
import type { AgentFallbackReason, AgentStopReason, AnswerMode } from '../enums/agent.enums';
import { AgentStep, TokenUsage } from './agentRun.interface';

export interface AnswerRequest extends AIRequest {
  /** Defaults to single-shot when absent. */
  mode?: AnswerMode;
}

export interface AgentAnswerDetails {
  stopReason: AgentStopReason;
  toolCalls: number;
  sourcesRead: string[];
  usage: TokenUsage;
  /** Per-turn tool trajectory (returned in evaluation traces; production callers may ignore). */
  steps: AgentStep[];
  modelCalls: number;
  durationMs: number;
}

/** `contexts` (from AIAnswer) holds the RAG chunks (single-shot) or the passages the tools showed (agent). */
export interface AnswerResult extends AIAnswer {
  /** Mode that actually produced the text. */
  mode?: AnswerMode;
  agent?: AgentAnswerDetails;
  /** Set when an agent request was answered single-shot. */
  fallbackReason?: AgentFallbackReason;
}

/**
 * What the polling jobs and the chat API depend on. `AIInvocationService`
 * satisfies it structurally (single-shot only); `AnswerService` adds the agent mode.
 */
export interface Answerer {
  answer(request: AnswerRequest): Promise<AnswerResult>;
}
