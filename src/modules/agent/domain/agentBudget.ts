/** Hard limits for one agent run; when reached the model must answer with what it has. */
export interface AgentBudget {
  /** Maximum tool calls per question. */
  maxToolCalls: number;
  /** Wall-clock limit for the whole run (it executes inside a poll tick). */
  maxDurationMs: number;
  /** Each tool result is cut to this many characters before reaching the model. */
  maxToolResultChars: number;
}

export const DEFAULT_AGENT_BUDGET: AgentBudget = {
  maxToolCalls: 6,
  maxDurationMs: 180_000,
  maxToolResultChars: 6_000,
};

export const TRUNCATION_NOTE = '\n…[truncated — ask for a specific heading to read the rest]';

export function truncateToolOutput(content: string, maxChars: number): string {
  return content.length <= maxChars ? content : content.slice(0, maxChars) + TRUNCATION_NOTE;
}
