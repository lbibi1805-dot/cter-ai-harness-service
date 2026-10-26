import type { AiModule } from '../../modules/ai';
import type { RerankModule } from '../../modules/rerank';
import { buildSingleShotRetriever, type RetrievalModule } from '../../modules/retrieval';
import type { VaultModule } from '../../modules/vault';
import { errorMessage } from '../../shared/errors';
import { logger } from '../../shared/logging/logger';
import { attempt } from '../../shared/resilience/attempt';

export interface RagWarmupDeps {
  vault: VaultModule;
  retrieval: RetrievalModule;
  ranking: RerankModule;
  ai: AiModule;
  rerankTopN: number;
}

/**
 * Indexes the vault in the background, then switches single-shot prompts from
 * knowledge.md to RAG. A failed index keeps knowledge.md (the service still answers).
 */
export async function indexVaultAndEnableRag({ vault, retrieval, ranking, ai, rerankTopN }: RagWarmupDeps): Promise<void> {
  const indexed = await attempt(() => vault.indexing.runNow());
  if (!indexed.ok) {
    logger.warn(`Vault indexing skipped or failed — falling back to knowledge.md: ${errorMessage(indexed.error)}`);
    return;
  }
  const stats = await attempt(() => vault.service.stats());
  if (stats.ok) {
    logger.info(`Neon vault stats: ${stats.value.indexed}/${stats.value.total} indexed — RAG ready`);
    // The manifest was cleared outside the app (SQL editor): drop the orphan vectors too.
    if (stats.value.total === 0) await vault.service.reconcileVectors();
  } else {
    logger.info('Document vault indexed — RAG ready');
  }
  const source = { defaultTopK: retrieval.config.topK, createRetriever: retrieval.createRetriever };
  ai.rag.markReady({ retriever: buildSingleShotRetriever(source, ranking, rerankTopN), builder: retrieval.citations });
}
