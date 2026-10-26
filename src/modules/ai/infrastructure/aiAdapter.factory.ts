import type OpenAI from 'openai';
import { errorMessage } from '../../../shared/errors';
import { attempt } from '../../../shared/resilience/attempt';
import { AIProvider, ModelRoute } from '../domain/enums/ai.enums';
import type { AiConfig } from '../domain/interfaces/aiConfig.interface';
import type { AIAdapter, AIAdapterFactory } from '../domain/interfaces/aiProvider.port';
import { OpenRouterAdapter } from './openrouter/openRouter.adapter';
import { createOpenRouterClient } from './openrouter/openRouter.client';
import { ClaudeAdapter } from './providers/claude.adapter';
import { GeminiAdapter } from './providers/gemini.adapter';
import { GrokAdapter } from './providers/grok.adapter';
import { OpenAIAdapter } from './providers/openai.adapter';
import { AI_PROVIDERS } from '../domain/constants/ai.constants';
import { KeyValidationResult } from './interfaces/aiAdapter.interface';
import { PROVIDER_KEY_ENV, OPENROUTER_KEY_ENV } from './constants/aiAdapter.constants';

/** Builds and caches the direct and OpenRouter adapters (SDK clients keep connection pools). */
export class ConfiguredAIAdapterFactory implements AIAdapterFactory {
  private readonly directAdapters = new Map<AIProvider, AIAdapter>();
  private readonly openRouterAdapters = new Map<AIProvider, AIAdapter>();
  private openRouterSdk: OpenAI | null = null;

  constructor(private readonly config: AiConfig) {}

  direct(provider: AIProvider): AIAdapter | null {
    const cached = this.directAdapters.get(provider);
    if (cached) return cached;
    const adapter = this.buildDirect(provider);
    if (adapter) this.directAdapters.set(provider, adapter);
    return adapter;
  }

  openRouter(provider: AIProvider): AIAdapter | null {
    const client = this.openRouterClient();
    if (!client) return null;
    const cached = this.openRouterAdapters.get(provider);
    if (cached) return cached;
    const adapter = new OpenRouterAdapter(client, this.config.openRouter, this.config.openRouter.fallbacks[provider]);
    this.openRouterAdapters.set(provider, adapter);
    return adapter;
  }

  credentialName(provider: AIProvider): string {
    return `${PROVIDER_KEY_ENV[provider]} (or ${OPENROUTER_KEY_ENV})`;
  }

  /** True when at least one route can serve the provider. */
  isConfigured(provider: AIProvider): boolean {
    return this.direct(provider) !== null || this.openRouter(provider) !== null;
  }

  /** The shared OpenRouter SDK client, or null without OPENROUTER_API_KEY. */
  openRouterClient(): OpenAI | null {
    if (!this.config.openRouter.apiKey) return null;
    this.openRouterSdk ??= createOpenRouterClient(this.config.openRouter);
    return this.openRouterSdk;
  }

  /** One check per configured credential: each direct key, then the OpenRouter key. */
  async validateKeys(): Promise<KeyValidationResult[]> {
    const checks: Promise<KeyValidationResult>[] = [];
    for (const provider of AI_PROVIDERS) {
      const adapter = this.direct(provider);
      if (adapter) checks.push(this.check(provider, adapter));
    }
    const openRouter = this.openRouter(AIProvider.OPENAI);
    if (openRouter) checks.push(this.check(ModelRoute.OPENROUTER, openRouter));
    return Promise.all(checks);
  }

  private async check(provider: KeyValidationResult['provider'], adapter: AIAdapter): Promise<KeyValidationResult> {
    const result = await attempt(() => adapter.validate());
    return result.ok ? { provider, ok: true } : { provider, ok: false, error: errorMessage(result.error) };
  }

  private buildDirect(provider: AIProvider): AIAdapter | null {
    const key = this.config.keys[provider];
    if (!key) return null;
    switch (provider) {
      case AIProvider.CLAUDE:
        return new ClaudeAdapter(key);
      case AIProvider.GEMINI:
        return new GeminiAdapter(key);
      case AIProvider.GROK:
        return new GrokAdapter(key, this.config.grokBaseUrl);
      case AIProvider.OPENAI:
        return new OpenAIAdapter(key);
    }
  }
}
