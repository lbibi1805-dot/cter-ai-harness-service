import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import { AIProvider, OpenAIApiMode } from '../../domain/enums/ai.enums';
import { UnsupportedModelError } from '../../domain/errors/ai.errors';
import type { AdapterCallOptions, AIAdapter, ProviderReply, ProviderUsage, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { ProviderTuning } from '../../domain/interfaces/latency.interface';
import { streamChatCompletion, withFinish, withUsage } from '../helpers/chatCompletionStream.helper';
import { chatFinishReason, responsesFinishReason } from '../helpers/finishReason.helper';
import { RESPONSES_INCOMPLETE_EVENT } from '../constants/finishReason.constants';
import type { FinishReason } from '../../domain/enums/ai.enums';
import { chatCompletionUsage, responsesUsage } from '../helpers/usage.helper';
import { isOpenAIReasoningModel, openAITuningFields } from '../helpers/openaiTuning.helper';
import { DIRECT_ALLOWED_MODELS } from '../../domain/constants/modelCatalog.constants';
import { getOpenAIApiMode } from '../../domain/helpers/modelCatalog.helper';
import { resolveProviderTuning } from '../../domain/helpers/latency.helper';
import { toChatMessages, toResponsesHistory, toResponsesUserMessage } from './openaiMessages';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';
import { RESPONSES_COMPLETED_EVENT, RESPONSES_TEXT_DELTA_EVENT } from '../constants/openai.constants';

/**
 * Direct OpenAI. Reasoning models get OPENAI_REASONING_EFFORT (default low: the default medium costs seconds of
 * TTFT), every request gets an output cap, the optional service tier and a `prompt_cache_key` (18 §5).
 */
export class OpenAIAdapter implements AIAdapter {
  private readonly client: OpenAI;
  private readonly tuning: ProviderTuning;

  constructor(apiKey: string, tuning?: Partial<ProviderTuning>, client?: OpenAI) {
    this.client = client ?? new OpenAI({ apiKey, maxRetries: SDK_MAX_RETRIES });
    this.tuning = resolveProviderTuning(tuning);
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options: AdapterCallOptions = {}): Promise<ProviderReply> {
    const apiMode = getOpenAIApiMode(AIProvider.OPENAI, model);
    if (!apiMode) throw new UnsupportedModelError(AIProvider.OPENAI, model, DIRECT_ALLOWED_MODELS[AIProvider.OPENAI]);
    if (apiMode === OpenAIApiMode.RESPONSES) return this.viaResponses(content, systemPrompt, model, onDelta, options);
    const body: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: toChatMessages(content, systemPrompt),
      max_completion_tokens: options.maxOutputTokens ?? this.tuning.maxOutputTokens,
      ...(isOpenAIReasoningModel(model) ? { reasoning_effort: this.tuning.openaiReasoningEffort } : {}),
      ...openAITuningFields(this.tuning, options.cacheKey, systemPrompt),
    };
    if (onDelta) return streamChatCompletion(this.client, { ...body, stream: true }, onDelta, options.signal);
    const response = await this.client.chat.completions.create(body, { signal: options.signal });
    return withFinish(withUsage({ text: response.choices[0]?.message.content ?? '', model }, chatCompletionUsage(response.usage)), chatFinishReason(response.choices[0]?.finish_reason));
  }

  private async viaResponses(content: PromptContent, systemPrompt: string, model: string, onDelta: TextDeltaListener | undefined, options: AdapterCallOptions): Promise<ProviderReply> {
    const input: OpenAI.Responses.ResponseInput = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      ...toResponsesHistory(content.history),
      toResponsesUserMessage(content),
    ];
    const body: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      input,
      max_output_tokens: options.maxOutputTokens ?? this.tuning.maxOutputTokens,
      ...(isOpenAIReasoningModel(model) ? { reasoning: { effort: this.tuning.openaiReasoningEffort } } : {}),
      ...openAITuningFields(this.tuning, options.cacheKey, systemPrompt),
    };
    if (!onDelta) {
      const response = await this.client.responses.create(body, { signal: options.signal });
      return withFinish(withUsage({ text: response.output_text ?? '', model }, responsesUsage(response.usage)), responsesFinishReason(response.status, response.incomplete_details?.reason));
    }
    let text = '';
    let usage: ProviderUsage | undefined;
    let finish: FinishReason | undefined;
    for await (const event of await this.client.responses.create({ ...body, stream: true }, { signal: options.signal })) {
      // A response cut by max_output_tokens ends with `response.incomplete` instead of `response.completed`.
      if (event.type === RESPONSES_COMPLETED_EVENT || event.type === RESPONSES_INCOMPLETE_EVENT) {
        usage = responsesUsage(event.response.usage);
        finish = responsesFinishReason(event.response.status, event.response.incomplete_details?.reason);
      }
      if (event.type !== RESPONSES_TEXT_DELTA_EVENT) continue;
      text += event.delta;
      onDelta(event.delta);
    }
    return withFinish(withUsage({ text, model }, usage), finish);
  }
}
