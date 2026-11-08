import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import type { AdapterCallOptions, AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import { streamChatCompletion, withUsage } from '../helpers/chatCompletionStream.helper';
import { chatCompletionUsage } from '../helpers/usage.helper';
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

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options: AdapterCallOptions = {}): Promise<ProviderReply> {
    const messages = toChatMessages(content, systemPrompt);
    const cap = options.maxOutputTokens ? { max_tokens: options.maxOutputTokens } : {};
    if (onDelta) return streamChatCompletion(this.client, { model, messages, ...cap, stream: true }, onDelta, options.signal);
    const response = await this.client.chat.completions.create({ model, messages, ...cap }, { signal: options.signal });
    return withUsage({ text: response.choices[0]?.message.content ?? '', model }, chatCompletionUsage(response.usage));
  }
}
