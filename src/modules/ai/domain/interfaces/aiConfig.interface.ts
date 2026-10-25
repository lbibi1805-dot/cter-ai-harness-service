import type { AIProvider, OpenRouterProviderSort } from '../enums/ai.enums';

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
}

export interface AiConfig {
  /** Direct API keys; a provider without one is served by OpenRouter only (if configured). */
  keys: Partial<PerProvider<string>>;
  /** Model used when the request names none. */
  defaultModels: PerProvider<string>;
  /** Direct fallback chain per provider, tried before OpenRouter. */
  modelFallback: PerProvider<string[]>;
  grokBaseUrl: string;
  timeoutMs: number;
  maxRetryCount: number;
  openRouter: OpenRouterConfig;
}
