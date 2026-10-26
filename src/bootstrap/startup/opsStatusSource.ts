import { AI_PROVIDERS, ModelRoute, perProvider, type AiModule } from '../../modules/ai';
import type { OpsStatusSource } from '../../modules/ops';
import type { PollingModule } from '../../modules/polling';
import type { VaultModule } from '../../modules/vault';
import type { AppConfig } from '../interfaces/appConfig.interface';

/** What `/`, `/health` and `/api/ai-usage` report, read live from the running modules. */
export function buildOpsStatusSource(config: AppConfig, ai: AiModule, polling: PollingModule, vault: VaultModule): OpsStatusSource {
  return {
    accounts: config.accounts,
    pollingState: () => polling.scheduler.status().state,
    aiCredentials: () => perProvider((provider) => ai.configuredAdapters.isConfigured(provider)),
    aiModels: () => ({
      /** Backend view of each provider's chain: direct models, then the OpenRouter fallback. */
      providers: Object.fromEntries(AI_PROVIDERS.map((provider) => {
        const fallback = ai.catalog.openRouterFallback(provider);
        const direct = ai.adapters.direct(provider) ? ai.catalog.chainFor(provider, ai.catalog.defaultModel(provider)) : [];
        return [provider, fallback ? [...direct, `${ModelRoute.OPENROUTER}:${fallback}`] : direct];
      })),
      defaults: perProvider((provider) => ai.catalog.defaultModel(provider)),
    }),
    vectorIndex: config.retrieval ? { index: config.retrieval.pineconeIndex, provider: config.retrieval.embeddingProvider } : null,
    vaultStats: () => vault.service.stats(),
  };
}
