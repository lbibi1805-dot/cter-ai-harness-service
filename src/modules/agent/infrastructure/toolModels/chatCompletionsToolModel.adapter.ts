import type OpenAI from 'openai';
import { toChatMessages } from '../../../ai';
import {
  type AgentToolDefinition,
  type ToolCallingModel,
  type ToolCallingSession,
} from '../../domain';
import { ChatCompletionsSession } from './chatCompletionsSession.adapter';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';
import { ChatCompletionsToolModelOptions } from '../interfaces/chatCompletionsToolModel.interface';

/**
 * Tool calling over the OpenAI-compatible Chat Completions API, which
 * OpenRouter normalises for every model that supports `tools`. The full
 * transcript (assistant tool calls + `role: tool` results) is resent each turn.
 */
export class ChatCompletionsToolModel implements ToolCallingModel {
  constructor(
    private readonly client: OpenAI,
    readonly model: string,
    private readonly options: ChatCompletionsToolModelOptions,
  ) {}

  startSession(systemPrompt: string, content: PromptContent, tools: AgentToolDefinition[]): ToolCallingSession {
    return new ChatCompletionsSession(this.client, this.model, this.options, toChatMessages(content, systemPrompt), tools);
  }
}
