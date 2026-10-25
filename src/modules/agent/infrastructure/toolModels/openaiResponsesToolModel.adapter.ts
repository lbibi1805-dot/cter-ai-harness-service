import type OpenAI from 'openai';
import {
  type AgentToolDefinition,
  type ToolCallingModel,
  type ToolCallingSession,
} from '../../domain';
import { OpenAIResponsesSession } from './openaiResponsesSession.adapter';
import { PromptContent } from '../../../ai/domain/interfaces/promptContent.interface';
import { ToolModelTimeouts } from '../interfaces/openaiResponsesToolModel.interface';

/** Tool calling via the OpenAI Responses API (direct OpenAI models whose API mode is `responses`). */
export class OpenAIResponsesToolModel implements ToolCallingModel {
  constructor(
    private readonly client: OpenAI,
    readonly model: string,
    private readonly options: ToolModelTimeouts,
  ) {}

  startSession(systemPrompt: string, content: PromptContent, tools: AgentToolDefinition[]): ToolCallingSession {
    return new OpenAIResponsesSession(this.client, this.model, this.options, systemPrompt, content, tools);
  }
}
