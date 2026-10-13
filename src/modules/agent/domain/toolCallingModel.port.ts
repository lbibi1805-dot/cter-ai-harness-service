import type { FileContent } from '../../../types';
import type { ModelTurnKind } from './agent.enums';
import type { TokenUsage } from './agentRun';
import type { AgentToolDefinition } from './agentTool';

export interface ToolCall {
  id: string;
  name: string;
  /** Raw JSON arguments exactly as the model produced them. */
  arguments: string;
}

export interface ToolOutput {
  callId: string;
  output: string;
}

export type ModelTurn =
  | { kind: ModelTurnKind.TOOL_CALLS; calls: ToolCall[]; usage: TokenUsage }
  | { kind: ModelTurnKind.FINAL; text: string; usage: TokenUsage };

/** One conversation with the model; it keeps the transcript between turns. */
export interface ToolCallingSession {
  /**
   * Sends the outputs of the previous tool calls (empty on the first turn).
   * With `allowTools: false` the model must answer in text; with
   * `requireTool: true` (and tools allowed) it must call a tool.
   */
  next(toolOutputs: ToolOutput[], options: TurnOptions): Promise<ModelTurn>;
}

export interface TurnOptions {
  allowTools: boolean;
  requireTool?: boolean;
}

/** Port implemented per provider (OpenAI Responses API in the MVP). */
export interface ToolCallingModel {
  readonly model: string;
  startSession(systemPrompt: string, content: FileContent, tools: AgentToolDefinition[]): ToolCallingSession;
}

/** Returns null when the provider/model cannot do tool calling. */
export type ToolCallingModelFactory = (provider: string, model: string) => ToolCallingModel | null;
