import { TRUNCATION_NOTE } from './constants/agent.constants';
import { AgentLimits, AgentBudget } from './interfaces/agentBudget.interface';
import { DEFAULT_AGENT_BUDGET } from './constants/agentBudget.constants';

/** Applies operator limits; the minimum can never exceed the maximum or go negative. */
export function buildAgentBudget(limits: AgentLimits): AgentBudget {
  const budget = { ...DEFAULT_AGENT_BUDGET, ...limits };
  budget.minToolCalls = Math.max(0, Math.min(budget.minToolCalls, budget.maxToolCalls));
  return budget;
}

export function truncateToolOutput(content: string, maxChars: number): string {
  return content.length <= maxChars ? content : content.slice(0, maxChars) + TRUNCATION_NOTE;
}
