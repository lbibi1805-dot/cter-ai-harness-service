import { UpstreamError, ValidationError } from '../../../../shared/errors';
import type { AgentStopReason } from '../enums/agent.enums';

/** Reported back to the model as a tool error (never thrown to the caller). */
export class UnknownToolError extends ValidationError {
  constructor(name: string, available: readonly string[]) {
    super(`unknown tool "${name}". Available: ${available.join(', ')}`);
  }
}

/** Reported back to the model as a tool error (never thrown to the caller). */
export class InvalidToolArgumentsError extends ValidationError {}

/** The model kept asking for tools on the forced final turn; the caller falls back to single-shot. */
export class ToolRequestAfterBudgetError extends UpstreamError {
  constructor(reason: AgentStopReason) {
    super(`model requested tools after the budget was exhausted (${reason})`);
  }
}
