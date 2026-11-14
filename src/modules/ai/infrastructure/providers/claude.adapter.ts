import Anthropic from '@anthropic-ai/sdk';
import { SDK_MAX_RETRIES } from '../../../../shared/resilience/constants/sdk.constants';
import { ConversationRole } from '../../domain/enums/ai.enums';
import { EmptyProviderResponseError } from '../../domain/errors/ai.errors';
import type { AdapterCallOptions, AIAdapter, ProviderReply, TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { ProviderTuning } from '../../domain/interfaces/latency.interface';
import { resolveProviderTuning } from '../../domain/helpers/latency.helper';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';
import { RenderedPartKind } from '../../domain/enums/historyRender.enums';
import { currentUserParts, renderHistory } from '../../domain/helpers/historyRender.helper';
import type { RenderedPart, RenderedTurn } from '../../domain/interfaces/historyRender.interface';
import { ClaudeImageMediaType } from '../interfaces/claude.interface';
import { CLAUDE_CACHE_CONTROL, CLAUDE_TEXT_BLOCK } from '../constants/claude.constants';
import { withFinish, withUsage } from '../helpers/chatCompletionStream.helper';
import { claudeFinishReason } from '../helpers/finishReason.helper';
import { clampOutputTokens } from '../../domain/helpers/outputLimit.helper';
import { claudeUsage } from '../helpers/usage.helper';

/**
 * Direct Anthropic. With PROMPT_CACHE_CLAUDE=true two `cache_control` breakpoints are set (end of the system
 * prompt, end of the history) so the next turn of the conversation reads them from the cache (18 §3).
 * Output cap = AI_MAX_OUTPUT_TOKENS like every other route (08 Bước 2; was a hard-coded 4096), clamped per model.
 */
export class ClaudeAdapter implements AIAdapter {
  private readonly client: Anthropic;
  private readonly tuning: ProviderTuning;

  constructor(apiKey: string, tuning?: Partial<ProviderTuning>, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey, maxRetries: SDK_MAX_RETRIES });
    this.tuning = resolveProviderTuning(tuning);
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options: AdapterCallOptions = {}): Promise<ProviderReply> {
    const rendered = renderHistory(content.history);
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: clampOutputTokens(model, options.maxOutputTokens ?? this.tuning.maxOutputTokens, !!onDelta),
      system: this.system(systemPrompt),
      messages: [...this.history(rendered.turns), { role: 'user', content: toBlocks(currentUserParts(content, rendered.lead)) }],
    };
    const requestOptions = { signal: options.signal };
    const response = onDelta
      ? await this.client.messages.stream(params, requestOptions).on('text', (text) => onDelta(text)).finalMessage()
      : await this.client.messages.create(params, requestOptions);
    const textBlock = response.content.find((block) => block.type === CLAUDE_TEXT_BLOCK);
    if (!textBlock || textBlock.type !== CLAUDE_TEXT_BLOCK) throw new EmptyProviderResponseError(`Claude ${model} returned no text`);
    return withFinish(withUsage({ text: textBlock.text, model }, claudeUsage(response.usage)), claudeFinishReason(response.stop_reason));
  }

  private system(systemPrompt: string): Anthropic.MessageCreateParams['system'] {
    if (!this.tuning.claudePromptCache) return systemPrompt;
    return [{ type: 'text', text: systemPrompt, cache_control: CLAUDE_CACHE_CONTROL }];
  }

  private history(turns: RenderedTurn[]): Anthropic.MessageParam[] {
    return turns.map((turn, index): Anthropic.MessageParam => {
      const role = turn.role === ConversationRole.USER ? 'user' : 'assistant';
      const cacheHere = this.tuning.claudePromptCache && index === turns.length - 1;
      if (!turn.hasImages) {
        return cacheHere ? { role, content: [{ type: 'text', text: turn.text, cache_control: CLAUDE_CACHE_CONTROL }] } : { role, content: turn.text };
      }
      const blocks = toBlocks(turn.parts);
      if (cacheHere) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: CLAUDE_CACHE_CONTROL } as Anthropic.ContentBlockParam;
      return { role, content: blocks };
    });
  }
}

function toBlocks(parts: RenderedPart[]): Anthropic.ContentBlockParam[] {
  return parts.map((part): Anthropic.ContentBlockParam => (part.kind === RenderedPartKind.TEXT
    ? { type: 'text', text: part.text }
    : { type: 'image', source: { type: 'base64', media_type: part.image.mimeType as ClaudeImageMediaType, data: part.image.data.toString('base64') } }));
}
