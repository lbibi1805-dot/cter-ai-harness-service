import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import type { AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import { streamChatCompletion } from '../helpers/chatCompletionStream.helper';
import { toChatMessages } from './openaiMessages';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

/** xAI exposes an OpenAI-compatible Chat Completions API. */
export class GrokAdapter implements AIAdapter {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL, maxRetries: SDK_MAX_RETRIES });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener): Promise<ProviderReply> {
    const messages = toChatMessages(content, systemPrompt);
    if (onDelta) return streamChatCompletion(this.client, { model, messages, stream: true }, onDelta);
    const response = await this.client.chat.completions.create({ model, messages });
    return { text: response.choices[0]?.message.content ?? '', model };
  }
}
