import type { AIProvider } from '../enums/ai.enums';
import { PromptContent } from './promptContent.interface';

export interface ProviderReply {
  text: string;
  /** The model that actually answered (OpenRouter may have fallen back to another one). */
  model: string;
}

/** One model vendor (or the OpenRouter gateway) behind a single call. */
export interface AIAdapter {
  process(content: PromptContent, systemPrompt: string, model: string): Promise<ProviderReply>;
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
