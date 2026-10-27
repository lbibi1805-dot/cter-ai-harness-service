import type { AIProvider } from '../enums/ai.enums';
import { PromptContent } from './promptContent.interface';

export interface ProviderReply {
  text: string;
  /** The model that actually answered (OpenRouter may have fallen back to another one). */
  model: string;
}

/** Receives answer text as the model produces it (streaming); the full reply is still returned at the end. */
export type TextDeltaListener = (text: string) => void;

/** One model vendor (or the OpenRouter gateway) behind a single call. */
export interface AIAdapter {
  /** With `onDelta`, the adapter streams and reports each text chunk; the returned reply holds the whole text. */
  process(content: PromptContent, systemPrompt: string, model: string, onDelta?: TextDeltaListener): Promise<ProviderReply>;
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
