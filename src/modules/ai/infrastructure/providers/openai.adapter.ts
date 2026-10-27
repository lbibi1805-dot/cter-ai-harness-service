import OpenAI from 'openai';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import { AIProvider, OpenAIApiMode } from '../../domain/enums/ai.enums';
import { UnsupportedModelError } from '../../domain/errors/ai.errors';
import type { AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import { streamChatCompletion } from '../helpers/chatCompletionStream.helper';
import { toDataUrl } from '../../domain/promptContent';
import { DIRECT_ALLOWED_MODELS } from '../../domain/constants/modelCatalog.constants';
import { getOpenAIApiMode } from '../../domain/helpers/modelCatalog.helper';
import { toChatMessages, toResponsesHistory } from './openaiMessages';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';
import { IMAGE_DETAIL, RESPONSES_TEXT_DELTA_EVENT } from '../constants/openai.constants';

export class OpenAIAdapter implements AIAdapter {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, maxRetries: SDK_MAX_RETRIES });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener): Promise<ProviderReply> {
    const apiMode = getOpenAIApiMode(AIProvider.OPENAI, model);
    if (!apiMode) throw new UnsupportedModelError(AIProvider.OPENAI, model, DIRECT_ALLOWED_MODELS[AIProvider.OPENAI]);
    if (apiMode === OpenAIApiMode.RESPONSES) return { text: await this.viaResponses(content, systemPrompt, model, onDelta), model };
    const messages = toChatMessages(content, systemPrompt);
    if (onDelta) return streamChatCompletion(this.client, { model, messages, stream: true }, onDelta);
    const response = await this.client.chat.completions.create({ model, messages });
    return { text: response.choices[0]?.message.content ?? '', model };
  }

  private async viaResponses(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener): Promise<string> {
    const input: OpenAI.Responses.ResponseInput = [
      { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
      ...toResponsesHistory(content.history),
      {
        role: 'user',
        content: [
          ...(content.textContent ? [{ type: 'input_text' as const, text: content.textContent }] : []),
          ...content.imageBuffers.map((image) => ({ type: 'input_image' as const, image_url: toDataUrl(image), detail: IMAGE_DETAIL })),
        ],
      },
    ];
    if (!onDelta) {
      const response = await this.client.responses.create({ model, input });
      return response.output_text ?? '';
    }
    let text = '';
    for await (const event of await this.client.responses.create({ model, input, stream: true })) {
      if (event.type !== RESPONSES_TEXT_DELTA_EVENT) continue;
      text += event.delta;
      onDelta(event.delta);
    }
    return text;
  }
}
