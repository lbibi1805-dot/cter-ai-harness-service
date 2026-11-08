import type { GeminiThinkingLevel } from '../enums/latency.enums';
import type { AIProvider } from '../enums/ai.enums';
import { PromptContent } from './promptContent.interface';

/** Token counts reported by the provider for one call; absent fields were not reported. */
export interface ProviderUsage {
  /** Whole prompt, cached part included. */
  inputTokens?: number;
  /** Answer (and reasoning/thinking) tokens. */
  outputTokens?: number;
  /** Prompt tokens served from the provider's prompt cache. */
  cachedTokens?: number;
}

export interface ProviderReply {
  text: string;
  /** The model that actually answered (OpenRouter may have fallen back to another one). */
  model: string;
  usage?: ProviderUsage;
}

/** Per-call options every adapter honours. */
export interface AdapterCallOptions {
  /** Aborts the HTTP request / stream (timeouts, request deadline). */
  signal?: AbortSignal;
  /** Stable key for provider prompt caching (OpenAI `prompt_cache_key`), e.g. the conversation id. */
  cacheKey?: string;
  /** Per-call output cap (lower than the configured default); absent = the adapter's default. */
  maxOutputTokens?: number;
  /** Per-call Gemini thinking level (e.g. Essay Mode `low`); absent = GEMINI_THINKING_LEVEL. Other adapters ignore it. */
  thinkingLevel?: GeminiThinkingLevel;
}

/** Receives answer text as the model produces it (streaming); the full reply is still returned at the end. */
export type TextDeltaListener = (text: string) => void;

/** One model vendor (or the OpenRouter gateway) behind a single call. */
export interface AIAdapter {
  /**
   * With `onDelta`, the adapter streams and reports each text chunk; the returned reply holds the whole text.
   * `options.signal` must be passed to the SDK so an aborted attempt stops at once.
   */
  process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener, options?: AdapterCallOptions): Promise<ProviderReply>;
  validate(): Promise<void>;
}

/** Hands out the adapters for each route of a provider. */
export interface AIAdapterFactory {
  /** The vendor's own API; null without its key. */
  direct(provider: AIProvider): AIAdapter | null;
  /** The OpenRouter fallback; null when OPENROUTER_API_KEY is not set. */
  openRouter(provider: AIProvider): AIAdapter | null;
  /** The setting an operator must fill in when the direct route is missing, e.g. `GEMINI_API_KEY`. */
  credentialName(provider: AIProvider): string;
}
