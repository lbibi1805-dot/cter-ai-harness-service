import { AIProvider } from '../enums/ai.enums';

export const AI_PROVIDERS: readonly AIProvider[] = Object.values(AIProvider);

export const DEFAULT_AI_TIMEOUT_MS = 120_000;

/** Retries per model after the first attempt (TRANSIENT failures). */
export const DEFAULT_MAX_RETRY_COUNT = 3;

/** A rate-limited model gets this many tries before the chain moves on. */
export const RATE_LIMIT_ATTEMPTS_PER_MODEL = 2;

/** Anthropic requires an explicit output cap; long exam answers fit in this. */
export const CLAUDE_MAX_OUTPUT_TOKENS = 4096;

export const GROK_DEFAULT_BASE_URL = 'https://api.x.ai/v1';

export const GEMINI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const OPENROUTER_DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export const DEFAULT_DIRECT_MODELS: Readonly<Record<AIProvider, string>> = {
  [AIProvider.CLAUDE]: 'claude-sonnet-4-6',
  [AIProvider.GEMINI]: 'gemini-3.5-flash',
  [AIProvider.GROK]: 'grok-3',
  [AIProvider.OPENAI]: 'gpt-6-astra',
};

export const DEFAULT_DIRECT_FALLBACKS: Readonly<Record<AIProvider, readonly string[]>> = {
  [AIProvider.CLAUDE]: ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  [AIProvider.GEMINI]: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'],
  [AIProvider.GROK]: ['grok-3', 'grok-4-1-fast-reasoning'],
  [AIProvider.OPENAI]: ['gpt-6-astra', 'gpt-5.3-codex', 'gpt-5', 'o3-mini', 'gpt-4o', 'gpt-4o-mini'],
};

export const OPENROUTER_DEFAULT_MODELS: Readonly<Record<AIProvider, string>> = {
  [AIProvider.CLAUDE]: 'anthropic/claude-sonnet-4.5',
  [AIProvider.GEMINI]: 'google/gemini-2.5-flash',
  [AIProvider.GROK]: 'x-ai/grok-4-fast',
  [AIProvider.OPENAI]: 'openai/gpt-5',
};
