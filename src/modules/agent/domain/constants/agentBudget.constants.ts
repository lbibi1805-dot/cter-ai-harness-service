import { AgentBudget } from '../interfaces/agentBudget.interface';

export const DEFAULT_AGENT_BUDGET: AgentBudget = {
  maxToolCalls: 6,
  minToolCalls: 1,
  maxDurationMs: 180_000,
  maxToolResultChars: 6_000,
};
