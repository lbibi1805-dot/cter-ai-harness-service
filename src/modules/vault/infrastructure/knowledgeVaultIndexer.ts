import { createEmbeddingService } from '../../../rag/embeddingService';
import { KnowledgeIndexer } from '../../../rag/knowledgeIndexer';
import type { AppConfig } from '../../../types';
import type { VaultIndexerFactory, VaultRepository } from '../domain';

/** Builds a fresh RAG indexer per run, or null when the vector index is not configured. */
export function createKnowledgeIndexerFactory(
  config: AppConfig,
  repository: VaultRepository,
): VaultIndexerFactory | null {
  const vaultConfig = config.vaultConfig;
  if (!vaultConfig) return null;
  return () => {
    const embedder = createEmbeddingService(vaultConfig.embeddingProvider, {
      gemini: config.aiKeys.gemini,
      openai: config.aiKeys.openai,
    });
    return new KnowledgeIndexer(vaultConfig, embedder, repository);
  };
}
