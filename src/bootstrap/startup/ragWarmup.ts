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
 * At startup (the database is awake anyway): load the manifest into RAM,
 * garbage-collect (pending deletes, orphan vectors/objects), index pending
 * files, then switch single-shot prompts from knowledge.md to RAG. A failure
 * keeps knowledge.md (the service still answers).
 */
export async function indexVaultAndEnableRag({ vault, retrieval, ranking, ai, rerankTopN }: RagWarmupDeps): Promise<void> {
  const reconciled = await attempt(() => vault.reconcile());
  if (!reconciled.ok) logger.warn(`Vault reconcile failed at startup: ${errorMessage(reconciled.error)}`);
  const indexed = await attempt(() => vault.indexing.runNow());
  if (!indexed.ok) {
    logger.warn(`Vault indexing skipped or failed — falling back to knowledge.md: ${errorMessage(indexed.error)}`);
    return;
  }
  const stats = await attempt(() => vault.service.stats());
  if (stats.ok) logger.info(`Vault stats: ${stats.value.indexed}/${stats.value.total} indexed — RAG ready`);
  else logger.info('Document vault indexed — RAG ready');
  const source = { defaultTopK: retrieval.config.topK, createRetriever: retrieval.createRetriever };
  ai.rag.markReady({ retriever: buildSingleShotRetriever(source, ranking, rerankTopN), builder: retrieval.citations });
}
