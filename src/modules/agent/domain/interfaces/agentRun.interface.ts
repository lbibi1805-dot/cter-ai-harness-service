import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import type { AgentStopReason, AgentToolName } from '../enums/agent.enums';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentStep {
  index: number;
  tool: AgentToolName | string;
  args: Record<string, unknown>;
  sources: string[];
  resultChars: number;
  durationMs: number;
  error?: string;
}

export interface AgentRunResult {
  text: string;
  model: string;
  stopReason: AgentStopReason;
  steps: AgentStep[];
  /** Distinct vault files the model was shown, in first-seen order. */
  sourcesRead: string[];
  /** Every passage the tools showed the model, in the order it saw them. */
  contexts: CitedChunk[];
  usage: TokenUsage;
  /** Model round-trips (each is one API call). */
  modelCalls: number;
  durationMs: number;
}
