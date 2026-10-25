import type { AIProvider } from '../../../ai/domain/enums/ai.enums';
import type { AgentFallbackReason, ModelTurnKind } from '../enums/agent.enums';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';
import { TokenUsage } from './agentRun.interface';
import { AgentToolDefinition } from './agentTool.interface';

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
  /** `model` is set when the gateway reports which model actually answered. */
  | { kind: ModelTurnKind.FINAL; text: string; usage: TokenUsage; model?: string };

export interface TurnOptions {
  allowTools: boolean;
  requireTool?: boolean;
}

/** One conversation with the model; it keeps the transcript between turns. */
export interface ToolCallingSession {
  /**
   * Sends the outputs of the previous tool calls (empty on the first turn).
   * With `allowTools: false` the model must answer in text; with
   * `requireTool: true` (and tools allowed) it must call a tool.
   */
  next(toolOutputs: ToolOutput[], options: TurnOptions): Promise<ModelTurn>;
}

/** Port implemented per API family (OpenAI Responses, Chat Completions via OpenRouter). */
export interface ToolCallingModel {
  readonly model: string;
  startSession(systemPrompt: string, content: PromptContent, tools: AgentToolDefinition[]): ToolCallingSession;
}

export type ToolModelResolution =
  | { supported: true; model: ToolCallingModel }
  | { supported: false; reason: AgentFallbackReason };

/** Decides whether a provider/model can run the agent loop, and builds it. */
export type ToolCallingModelFactory = (provider: AIProvider, model: string) => Promise<ToolModelResolution>;
