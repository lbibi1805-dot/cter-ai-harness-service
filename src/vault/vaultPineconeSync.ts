import type { VaultEntry, VaultStorage } from './VaultStorage';
import type { VaultConfig } from '../types';
import { VectorStore } from '../rag/vectorStore';
import { logger } from '../utils/logger';

export async function syncDeleteFile(entry: VaultEntry, config: VaultConfig): Promise<'ok' | 'skip' | 'partial'> {
  if (!entry.chunkIds || entry.chunkIds.length === 0) return 'skip';
  if (!config.pineconeApiKey || !config.pineconeIndex) return 'skip';
  try {
    const vs = new VectorStore(config.pineconeApiKey, config.pineconeIndex);
    await vs.deleteByIds(entry.chunkIds);
    logger.info(`[vault] pinecone delete ${entry.chunkIds.length} chunks for ${entry.filePath}`);
    return 'ok';
  } catch (err) {
    logger.info(`[vault] pinecone delete failed for ${entry.filePath}: ${(err as Error).message} — will orphan, reconcile later`);
    return 'partial';
  }
}

export async function syncDeleteAll(config: VaultConfig): Promise<void> {
  if (!config.pineconeApiKey || !config.pineconeIndex) return;
  try {
    const vs = new VectorStore(config.pineconeApiKey, config.pineconeIndex);
    await vs.deleteAll();
    logger.info(`[vault] pinecone deleteAll for index ${config.pineconeIndex}`);
  } catch (err) {
    if ((err as Error).message?.includes('404')) {
      logger.info(`[vault] pinecone deleteAll already empty (404) for ${config.pineconeIndex}`);
      return;
    }
    throw err;
  }
}

export async function reconcileOrphans(storage: VaultStorage, config: VaultConfig): Promise<number> {
  if (!config.pineconeApiKey || !config.pineconeIndex) return 0;
  const { entries } = await storage.list({ limit: 10000, offset: 0 });
  // If Neon is empty, deleteAll is cheapest — 404 means already empty
  if (entries.length === 0) {
    try {
      const vs = new VectorStore(config.pineconeApiKey, config.pineconeIndex);
      await vs.deleteAll();
      logger.info('[vault] reconcile: Neon empty → pinecone deleteAll');
      return -1; // signal deleteAll
    } catch (err) {
      if ((err as Error).message?.includes('404')) {
        logger.info('[vault] reconcile: pinecone already empty (404)');
        return -1;
      }
      logger.info(`[vault] reconcile deleteAll failed: ${(err as Error).message}`);
      return 0;
    }
  }
  // For non-empty, we can't list all Pinecone IDs cheaply without scan;
  // we ensure Neon chunkIds are valid — orphan detection would need Pinecone list.
  // For now, no-op when Neon non-empty (single-file deletes already sync).
  return 0;
}
