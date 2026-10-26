/** Operator-tunable agent limits (AGENT_* environment variables). */
export interface AgentLimits {
  /** Maximum tool calls per question. */
  maxToolCalls: number;
  /**
   * Tool calls the model must make before it may answer. Without it the model
   * often answers general questions from memory and never reads the vault.
   */
  minToolCalls: number;
  /** Wall-clock limit for the whole run (it executes inside a poll tick). */
  maxDurationMs: number;
}

/** Hard limits for one agent run; when reached the model must answer with what it has. */
export interface AgentBudget extends AgentLimits {
  /** Each tool result is cut to this many characters before reaching the model. */
  maxToolResultChars: number;
}
