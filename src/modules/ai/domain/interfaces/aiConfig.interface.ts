import type { AIProvider, OpenRouterProviderSort } from '../enums/ai.enums';
import type { AiLatencySettings, ProviderTuning } from './latency.interface';

export type PerProvider<T> = Record<AIProvider, T>;

/** The backend's fallback route; active only when `apiKey` is set. */
export interface OpenRouterConfig {
  apiKey?: string;
  baseUrl: string;
  /** Sent as `HTTP-Referer` / `X-Title` so usage shows up per app on openrouter.ai. */
  appUrl?: string;
  appTitle?: string;
  /** OpenRouter model used when the provider's direct route fails, e.g. `anthropic/claude-sonnet-4.5`. */
  models: PerProvider<string>;
  /** Sent as the `models` array: OpenRouter falls back through them server-side, in order. */
  fallbacks: PerProvider<string[]>;
  providerSort?: OpenRouterProviderSort;
  /** OpenRouter `provider.allow_fallbacks`: may it try other hosts of the same model. */
  allowProviderFallbacks: boolean;
  /** Sent as `max_tokens` on every OpenRouter request (credit is reserved against it). */
  maxTokens: number;
}

export interface AiConfig {
  /** Direct API keys; a provider without one is served by OpenRouter only (if configured). */
  keys: Partial<PerProvider<string>>;
  /** Model used when the request names none. */
  defaultModels: PerProvider<string>;
  /** Direct fallback chain per provider, tried before OpenRouter. */
  modelFallback: PerProvider<string[]>;
  grokBaseUrl: string;
  /** AI_TIMEOUT_MS: per-attempt cap of a non-streamed call (streamed ones use the first-token/idle timeouts). */
  timeoutMs: number;
  maxRetryCount: number;
  openRouter: OpenRouterConfig;
  /** Omitted = DEFAULT_AI_LATENCY. */
  latency?: Partial<AiLatencySettings>;
  /** Omitted = DEFAULT_PROVIDER_TUNING. */
  tuning?: Partial<ProviderTuning>;
  /**
   * GEMINI_INLINE_IMAGES_MAX_MB in bytes (read with the chat limits): above it, a Gemini request's images
   * go through the Files API instead of inline. Omitted = 15 MB.
   */
  geminiInlineImagesMaxBytes?: number;
}
