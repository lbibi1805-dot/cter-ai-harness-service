import { describe, expect, it } from 'vitest';
import { FinishReason, GeminiThinkingLevel, clampOutputTokens } from '../../../../../src/modules/ai';
import { chatFinishReason, claudeFinishReason, geminiFinishReason, responsesFinishReason } from '../../../../../src/modules/ai/infrastructure/helpers/finishReason.helper';
import { fitThinkingLevel } from '../../../../../src/modules/ai/infrastructure/helpers/geminiThinking.helper';
import { ClaudeAdapter } from '../../../../../src/modules/ai/infrastructure/providers/claude.adapter';
import type Anthropic from '@anthropic-ai/sdk';

describe('finish reasons (12/11 plan 08 Bước 2)', () => {
  it('maps every vendor reason to stop / length / safety / other', () => {
    expect(chatFinishReason('length')).toBe(FinishReason.LENGTH);
    expect(chatFinishReason('stop')).toBe(FinishReason.STOP);
    expect(chatFinishReason('content_filter')).toBe(FinishReason.SAFETY);
    expect(chatFinishReason(null)).toBeUndefined();
    expect(responsesFinishReason('incomplete', 'max_output_tokens')).toBe(FinishReason.LENGTH);
    expect(responsesFinishReason('completed', undefined)).toBe(FinishReason.STOP);
    expect(claudeFinishReason('max_tokens')).toBe(FinishReason.LENGTH);
    expect(claudeFinishReason('end_turn')).toBe(FinishReason.STOP);
    expect(claudeFinishReason('refusal')).toBe(FinishReason.SAFETY);
    expect(geminiFinishReason('MAX_TOKENS')).toBe(FinishReason.LENGTH);
    expect(geminiFinishReason('STOP')).toBe(FinishReason.STOP);
    expect(geminiFinishReason('SAFETY')).toBe(FinishReason.SAFETY);
  });

  it('output cap: only SDK-confirmed limits clamp (Claude Opus 4 non-streaming 8192); others keep the configured cap', () => {
    expect(clampOutputTokens('claude-opus-4-1-20250805', 16_384, false)).toBe(8192);
    expect(clampOutputTokens('claude-opus-4-1-20250805', 16_384, true)).toBe(16_384);
    expect(clampOutputTokens('claude-sonnet-4-6', 16_384, false)).toBe(16_384);
    expect(clampOutputTokens('gemini-3.5-flash', 16_384, true)).toBe(16_384);
  });

  it('Gemini thinking is lowered when it would leave the answer < 4096 tokens of the cap', () => {
    expect(fitThinkingLevel('gemini-2.5-flash', GeminiThinkingLevel.MEDIUM, 8192)).toBe(GeminiThinkingLevel.LOW);
    expect(fitThinkingLevel('gemini-2.5-flash', GeminiThinkingLevel.MEDIUM, 16_384)).toBe(GeminiThinkingLevel.MEDIUM);
    expect(fitThinkingLevel('gemini-3.5-flash', GeminiThinkingLevel.HIGH, 16_384)).toBe(GeminiThinkingLevel.MEDIUM);
    expect(fitThinkingLevel('gemini-3.5-flash', GeminiThinkingLevel.MINIMAL, 1000)).toBe(GeminiThinkingLevel.MINIMAL);
  });

  it('Claude uses AI_MAX_OUTPUT_TOKENS (no hard-coded 4096) and reports max_tokens as length', async () => {
    let sent: Anthropic.MessageCreateParams | undefined;
    const fake = {
      messages: {
        create: async (params: Anthropic.MessageCreateParams) => {
          sent = params;
          return { content: [{ type: 'text', text: 'cut answer' }], stop_reason: 'max_tokens', usage: { input_tokens: 1, output_tokens: 2 } };
        },
      },
    } as unknown as Anthropic;
    const adapter = new ClaudeAdapter('key', { maxOutputTokens: 16_384 }, fake);
    const reply = await adapter.process({ textContent: 'q', imageBuffers: [] }, 'sys', 'claude-sonnet-4-6');
    expect(sent?.max_tokens).toBe(16_384);
    expect(reply.finishReason).toBe(FinishReason.LENGTH);
  });
});
