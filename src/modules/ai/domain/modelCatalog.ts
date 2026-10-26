import { AIProvider } from './enums/ai.enums';
import { ModelCatalogConfig } from './interfaces/modelCatalog.interface';
import { DIRECT_ALLOWED_MODELS } from './constants/modelCatalog.constants';
import { getOpenAIApiMode } from './helpers/modelCatalog.helper';

/**
 * Which models a request may name and which ones the backend tries. Clients
 * only ever see the direct catalog; the OpenRouter fallback is a backend
 * decision. Every entry point (file name, chat header, HTTP body) goes
 * through this so the rules cannot drift apart.
 */
export class ModelCatalog {
  constructor(private readonly config: ModelCatalogConfig) {}

  defaultModel(provider: AIProvider): string {
    return this.config.defaultModels[provider];
  }

  resolve(provider: AIProvider, requested: string | undefined): string {
    return requested?.trim() || this.defaultModel(provider);
  }

  isAllowed(provider: AIProvider, model: string): boolean {
    return DIRECT_ALLOWED_MODELS[provider].includes(model);
  }

  /** Shown in validation errors and `GET /api/chat/status`. */
  allowedModels(provider: AIProvider): string[] {
    return [...DIRECT_ALLOWED_MODELS[provider]];
  }

  /** Direct models tried in order, primary first. OpenAI fallbacks must share the primary's API mode. */
  chainFor(provider: AIProvider, primary: string): string[] {
    const primaryMode = getOpenAIApiMode(provider, primary);
    const chain = [primary];
    for (const model of this.config.modelFallback[provider]) {
      if (chain.includes(model)) continue;
      if (provider === AIProvider.OPENAI && getOpenAIApiMode(provider, model) !== primaryMode) continue;
      chain.push(model);
    }
    return chain;
  }

  /** The OpenRouter model tried after the direct chain; null when OpenRouter is not configured. */
  openRouterFallback(provider: AIProvider): string | null {
    return this.config.openRouter.apiKey ? this.config.openRouter.models[provider] : null;
  }
}
