import Anthropic from '@anthropic-ai/sdk';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import { CLAUDE_MAX_OUTPUT_TOKENS } from '../../domain/constants/ai.constants';
import { ConversationRole } from '../../domain/enums/ai.enums';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';
import { ClaudeImageMediaType } from '../interfaces/claude.interface';
import { CLAUDE_TEXT_BLOCK } from '../constants/claude.constants';

export class ClaudeAdapter implements AIAdapter {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, maxRetries: SDK_MAX_RETRIES });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener): Promise<ProviderReply> {
    const userContent: Anthropic.MessageParam['content'] = [];
    if (content.textContent) userContent.push({ type: 'text', text: content.textContent });
    for (const image of content.imageBuffers) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType as ClaudeImageMediaType, data: image.data.toString('base64') },
      });
    }

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: CLAUDE_MAX_OUTPUT_TOKENS,
      system: systemPrompt,
      messages: [
        ...(content.history ?? []).map((turn): Anthropic.MessageParam => ({
          role: turn.role === ConversationRole.USER ? 'user' : 'assistant',
          content: turn.text,
        })),
        { role: 'user', content: userContent },
      ],
    };
    const response = onDelta
      ? await this.client.messages.stream(params).on('text', (text) => onDelta(text)).finalMessage()
      : await this.client.messages.create(params);
    const textBlock = response.content.find((block) => block.type === CLAUDE_TEXT_BLOCK);
    if (!textBlock || textBlock.type !== CLAUDE_TEXT_BLOCK) throw new EmptyProviderResponseError(`Claude ${model} returned no text`);
    return { text: textBlock.text, model };
  }
}
