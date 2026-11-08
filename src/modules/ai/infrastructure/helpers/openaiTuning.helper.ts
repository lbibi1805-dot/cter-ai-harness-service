import { createHash } from 'crypto';
import { PromptCacheKeyMode } from '../../domain/enums/latency.enums';
import type { ProviderTuning } from '../../domain/interfaces/latency.interface';
import {
  CONVERSATION_CACHE_KEY_PREFIX,
  OPENAI_REASONING_MODEL_PATTERN,
  PROMPT_CACHE_KEY_MAX_CHARS,
  PROMPT_VERSION_CACHE_KEY_PREFIX,
  PROMPT_VERSION_HASH_CHARS,
} from '../constants/openai.constants';

/** o-series, gpt-5*, gpt-6* and codex models accept a reasoning effort; gpt-4o does not. */
export function isOpenAIReasoningModel(model: string): boolean {
  return OPENAI_REASONING_MODEL_PATTERN.test(model);
}

/** `prompt_cache_key` per OPENAI_PROMPT_CACHE_KEY; undefined = do not send one. */
export function promptCacheKey(mode: PromptCacheKeyMode, cacheKey: string | undefined, systemPrompt: string): string | undefined {
  if (mode === PromptCacheKeyMode.OFF) return undefined;
  const key = mode === PromptCacheKeyMode.CONVERSATION && cacheKey
    ? `${CONVERSATION_CACHE_KEY_PREFIX}${cacheKey}`
    : `${PROMPT_VERSION_CACHE_KEY_PREFIX}${createHash('sha256').update(systemPrompt).digest('hex').slice(0, PROMPT_VERSION_HASH_CHARS)}`;
  return key.slice(0, PROMPT_CACHE_KEY_MAX_CHARS);
}

/** Fields shared by the Chat Completions and Responses bodies. */
export function openAITuningFields(tuning: ProviderTuning, cacheKey: string | undefined, systemPrompt: string) {
  const key = promptCacheKey(tuning.openaiPromptCacheKey, cacheKey, systemPrompt);
  return {
    ...(tuning.openaiServiceTier ? { service_tier: tuning.openaiServiceTier } : {}),
    ...(key ? { prompt_cache_key: key } : {}),
  };
}
