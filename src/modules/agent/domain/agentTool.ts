import type { AgentToolName } from './agent.enums';

export interface ToolResult {
  /** Text handed back to the model. */
  content: string;
  /** Vault files this result actually showed the model — the only citable sources. */
  sources: string[];
}

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  /** JSON Schema of the arguments object. */
  parameters: Record<string, unknown>;
}

/** A read-only capability the model may call. Must never write or have side effects. */
export interface AgentTool extends AgentToolDefinition {
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
