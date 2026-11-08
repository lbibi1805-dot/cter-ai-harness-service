import type { AIProvider, AiModule } from '../../modules/ai';
import { createEssayModule, VaultExemplarSource, type EssayService } from '../../modules/essay';
import type { RerankModule } from '../../modules/rerank';
import type { RetrievalModule } from '../../modules/retrieval';
import type { VaultModule } from '../../modules/vault';
import type { AppConfig } from '../interfaces/appConfig.interface';

export interface EssayWiringDeps {
  ai: AiModule;
  retrieval: RetrievalModule | null;
  ranking: RerankModule;
  vault: VaultModule;
  isProviderConfigured: (provider: AIProvider) => boolean;
}

/** Essay Mode (15) needs retrieval; the aux model (steps ① and ⑦) is used when its provider is configured. */
export function buildEssayService(config: AppConfig, { ai, retrieval, ranking, vault, isProviderConfigured }: EssayWiringDeps): EssayService | null {
  if (!retrieval) return null;
  const aux = config.context.aux;
  return createEssayModule(config.essay, {
    invocation: ai.invocation,
    createRetriever: (topK) => retrieval.createRetriever(topK),
    reranker: ranking,
    aux: isProviderConfigured(aux.provider) ? { provider: aux.provider, model: aux.model } : null,
    registry: config.prompts.registry ?? null,
    exemplars: retrieval.lexical ? new VaultExemplarSource(retrieval.lexical, (filePath) => vault.service.readDocument(filePath)) : null,
    systemPrompt: config.prompts.systemPrompt,
    promptLayout: config.context.settings.promptLayout,
  });
}
