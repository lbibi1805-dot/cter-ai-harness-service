import type OpenAI from 'openai';
import type Anthropic from '@anthropic-ai/sdk';
import type { GenerateContentResponseUsageMetadata } from '@google/genai';
import type { ProviderUsage } from '../../domain/interfaces/aiProvider.port';

/** Chat Completions (OpenAI, xAI, OpenRouter): `prompt_tokens` already includes the cached part. */
export function chatCompletionUsage(usage: OpenAI.CompletionUsage | null | undefined): ProviderUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
  };
}

/** Responses API: `input_tokens` already includes the cached part. */
export function responsesUsage(usage: OpenAI.Responses.ResponseUsage | null | undefined): ProviderUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
  };
}

/**
 * Anthropic reports uncached input, cache writes and cache reads separately; `inputTokens` is their sum so the
 * cache hit rate (cached / input) means the same for every provider.
 */
export function claudeUsage(usage: Anthropic.Usage | null | undefined): ProviderUsage | undefined {
  if (!usage) return undefined;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return { inputTokens: usage.input_tokens + cacheRead + cacheWrite, outputTokens: usage.output_tokens, cachedTokens: cacheRead };
}

/** Gemini: `promptTokenCount` includes the cached part; thinking tokens count as output. */
export function geminiUsage(usage: GenerateContentResponseUsageMetadata | undefined): ProviderUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    cachedTokens: usage.cachedContentTokenCount ?? 0,
  };
}
