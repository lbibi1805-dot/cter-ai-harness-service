import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';
import type { AgentToolName } from '../enums/agent.enums';

export interface ToolResult {
  /** Text handed back to the model. */
  content: string;
  /** Vault files this result actually showed the model — the only citable sources. */
  sources: string[];
  /** Passages shown to the model, kept for evaluation traces (faithfulness, context precision). */
  contexts?: CitedChunk[];
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
