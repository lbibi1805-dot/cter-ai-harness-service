import type { AgentStopReason, AgentToolName } from './agent.enums';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens };
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
  usage: TokenUsage;
  /** Model round-trips (each is one API call). */
  modelCalls: number;
  durationMs: number;
}
