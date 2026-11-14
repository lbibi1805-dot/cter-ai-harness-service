import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import type { AdapterCallOptions, AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import { streamChatCompletion, withFinish, withUsage } from '../helpers/chatCompletionStream.helper';
import { chatFinishReason } from '../helpers/finishReason.helper';
import { resolveProviderTuning } from '../../domain/helpers/latency.helper';
import type { ProviderTuning } from '../../domain/interfaces/latency.interface';
import { chatCompletionUsage } from '../helpers/usage.helper';
import { toChatMessages } from './openaiMessages';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

/** xAI exposes an OpenAI-compatible Chat Completions API; `max_tokens` = AI_MAX_OUTPUT_TOKENS (08 Bước 2). */
export class GrokAdapter implements AIAdapter {
  private readonly client: OpenAI;
  private readonly tuning: ProviderTuning;

  constructor(apiKey: string, baseURL: string, tuning?: Partial<ProviderTuning>, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey, baseURL, maxRetries: SDK_MAX_RETRIES });
    this.tuning = resolveProviderTuning(tuning);
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options: AdapterCallOptions = {}): Promise<ProviderReply> {
    const messages = toChatMessages(content, systemPrompt);
    const cap = { max_tokens: options.maxOutputTokens ?? this.tuning.maxOutputTokens };
    if (onDelta) return streamChatCompletion(this.client, { model, messages, ...cap, stream: true }, onDelta, options.signal);
    const response = await this.client.chat.completions.create({ model, messages, ...cap }, { signal: options.signal });
    return withFinish(withUsage({ text: response.choices[0]?.message.content ?? '', model }, chatCompletionUsage(response.usage)), chatFinishReason(response.choices[0]?.finish_reason));
  }
}
