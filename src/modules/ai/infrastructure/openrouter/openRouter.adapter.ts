import type OpenAI from 'openai';
import type { OpenRouterConfig } from '../../domain/interfaces/aiConfig.interface';
import type { AIAdapter, ProviderReply } from '../../domain/interfaces/aiProvider.port';
import { toChatMessages } from '../providers/openaiMessages';
import { assertCompletion, buildRoutingFields } from './openRouter.client';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

/**
 * Serves one provider through OpenRouter's Chat Completions endpoint. The
 * provider's fallback models travel in the request so OpenRouter switches
 * models server-side; `model` in the reply says which one answered.
 */
export class OpenRouterAdapter implements AIAdapter {
  constructor(
    private readonly client: OpenAI,
    private readonly config: OpenRouterConfig,
    private readonly fallbacks: readonly string[],
  ) {}

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string): Promise<ProviderReply> {
    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: toChatMessages(content, systemPrompt),
      ...buildRoutingFields(model, this.fallbacks, this.config),
    };
    const completion = await this.client.chat.completions.create(body);
    const choice = assertCompletion(completion, model);
    return { text: choice.message.content ?? '', model: completion.model || model };
  }
}
