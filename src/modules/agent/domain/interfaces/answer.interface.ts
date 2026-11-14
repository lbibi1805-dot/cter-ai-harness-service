import type { AIAnswer, AIRequest } from '../../../ai';
import type { AgentFallbackReason, AgentStopReason, AnswerMode } from '../enums/agent.enums';
import { AgentStep, TokenUsage } from './agentRun.interface';
import type { AgentTool } from './agentTool.interface';

export interface AnswerRequest extends AIRequest {
  /** Defaults to single-shot when absent. */
  mode?: AnswerMode;
  /** Agent mode only: per-request tools (the conversation's artifact tools). */
  extraTools?: AgentTool[];
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
  /** Set by the AnswerOrchestrator (12/11 plan 08): questions, sections, continuations and what is still missing. */
  completeness?: AnswerCompletenessDetails;
}

/** How a long / multi-question answer was produced (12/11 plan 08). */
export interface AnswerCompletenessDetails {
  questions: number;
  sections: number;
  continuations: number;
  /** True when the coverage-fix call ran. */
  coverageFix: boolean;
  /** Question ids still missing at the end (empty = complete). */
  missing: string[];
  /** True when the last call was still cut by the output cap. */
  truncated: boolean;
}

/**
 * What the polling jobs and the chat API depend on. `AIInvocationService`
 * satisfies it structurally (single-shot only); `AnswerService` adds the agent mode.
 */
export interface Answerer {
  answer(request: AnswerRequest): Promise<AnswerResult>;
}
