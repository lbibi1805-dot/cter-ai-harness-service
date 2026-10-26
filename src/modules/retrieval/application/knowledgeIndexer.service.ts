import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { sleep as realSleep, retryTransient } from '../../../shared/resilience/retry';
import { computeContentHash, type VaultEntry, type VaultRepository } from '../../vault/domain';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { chunkDocument } from '../domain/markdownChunker';
import { EMBEDDING_BACKOFF, EMBEDDING_MAX_ATTEMPTS } from '../domain/constants/retrieval.constants';
import type { IndexedChunk } from '../domain/interfaces/retrieval.interface';
import { normalizeText } from '../domain/textNormalizer';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';
import { Sleep } from '../../../shared/resilience/interfaces/retry.interface';
import { EMPTY_FILES_PREVIEW } from './constants/knowledgeIndexer.constants';
import { IndexingSettings, IndexingPlan } from './interfaces/knowledgeIndexer.interface';

/**
 * Brings Pinecone in line with the vault stored in the database: changed files
 * are re-chunked, embedded and upserted; their old vectors are deleted first.
 * A file is marked indexed only when every one of its chunks got a vector.
 */
export class KnowledgeIndexer {
  constructor(
    private readonly settings: IndexingSettings,
    private readonly embedder: EmbeddingService,
    private readonly repository: VaultRepository,
    private readonly vectorStore: VectorStore,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async indexAll(): Promise<void> {
    await this.prepareIndex();

    const entries = await this.repository.findAll();
    if (entries.length === 0) {
      logger.info('Neon vault empty — nothing to index');
      return;
    }

    const plan = this.planIndexing(entries);
    this.reportEmptyFiles(plan.emptyContent);
    if (plan.indexable.length === 0) {
      this.reportNothingToIndex(entries, plan);
      return;
    }

    logger.info(`Neon vault: ${entries.length} files, ${plan.indexable.length} pending — indexing ${plan.indexable.length} files`);
    const chunksByFile = await this.chunkFiles(plan.indexable);
    const allChunks = [...chunksByFile.values()].flat();
    await this.embedChunks(allChunks);

    const embedded = allChunks.filter((chunk) => chunk.vector.length > 0);
    if (embedded.length > 0) {
      logger.info(`Upserting ${embedded.length}/${allChunks.length} chunks to Pinecone...`);
      await this.vectorStore.upsertChunks(embedded);
    }
    await this.saveIndexingResults(plan.indexable, chunksByFile);
    logger.info(`Vault indexing complete — ${embedded.length} new chunks stored`);
  }

  /** Pinecone being down must not block startup: the manifest is still updated. */
  private async prepareIndex(): Promise<void> {
    const ready = await attempt(() => this.vectorStore.ensureIndex(this.embedder.dimension));
    if (!ready.ok) logger.warn(`Pinecone unavailable — proceeding with manifest only (${errorMessage(ready.error)})`);
  }

  private planIndexing(entries: VaultEntry[]): IndexingPlan {
    const indexable: VaultEntry[] = [];
    const emptyContent: string[] = [];
    for (const entry of entries) {
      const content = entry.content ?? '';
      if (!content.trim()) {
        emptyContent.push(entry.filePath);
        continue;
      }
      if (!entry.indexed || computeContentHash(content) !== entry.hash) indexable.push(entry);
    }
    return { indexable, emptyContent };
  }

  private reportEmptyFiles(emptyContent: string[]): void {
    if (emptyContent.length === 0) return;
    const preview = emptyContent.slice(0, EMPTY_FILES_PREVIEW).join(', ');
    const more = emptyContent.length > EMPTY_FILES_PREVIEW ? '…' : '';
    logger.info(`Neon vault has ${emptyContent.length} files with empty content (need re-upload): ${preview}${more}`);
  }

  private reportNothingToIndex(entries: VaultEntry[], plan: IndexingPlan): void {
    const pending = entries.filter((entry) => !entry.indexed).length;
    if (pending === 0) logger.info(`All ${entries.length} files indexed — skipping`);
    else logger.info(`Neon vault: ${entries.length} files, ${pending} pending but ${plan.emptyContent.length} have empty content — skipping (re-upload needed)`);
  }

  /** Chunks each file and records its new chunk ids before embedding, so a crash never loses track of vectors. */
  private async chunkFiles(files: VaultEntry[]): Promise<Map<string, IndexedChunk[]>> {
    const chunksByFile = new Map<string, IndexedChunk[]>();
    let chunkCounter = 0;
    for (const entry of files) {
      await this.deleteOldVectors(entry);
      const chunks = chunkDocument(entry.filePath, normalizeText(entry.content), () => chunkCounter++);
      chunksByFile.set(entry.filePath, chunks);
      await this.repository.save({
        filePath: entry.filePath,
        hash: computeContentHash(entry.content),
        chunkIds: chunks.map((chunk) => chunk.id),
        indexed: false,
        content: entry.content,
      });
    }
    return chunksByFile;
  }

  /** Best effort: stale vectors of an edited file are harmless and get overwritten by id. */
  private async deleteOldVectors(entry: VaultEntry): Promise<void> {
    if (entry.chunkIds.length === 0) return;
    const deleted = await attempt(() => this.vectorStore.deleteByIds(entry.chunkIds));
    if (!deleted.ok) logger.warn(`Could not delete old vectors of ${entry.filePath}: ${errorMessage(deleted.error)}`);
  }

  /** Fills `chunk.vector` in place; a batch that keeps failing is left empty (its files stay unindexed). */
  private async embedChunks(chunks: IndexedChunk[]): Promise<void> {
    const { embeddingBatchSize: batchSize, embeddingDelayMs: delayMs, embeddingProvider } = this.settings;
    const totalBatches = Math.ceil(chunks.length / batchSize);
    logger.info(`Embedding ${chunks.length} new chunks... (provider=${embeddingProvider}, batch=${batchSize}, delay=${delayMs}ms)`);

    for (let start = 0; start < chunks.length; start += batchSize) {
      const batch = chunks.slice(start, start + batchSize);
      const batchNumber = start / batchSize + 1;
      logger.info(`Embedding batch ${batchNumber}/${totalBatches} (${batch.length} chunks, ${start + 1}-${start + batch.length}/${chunks.length})`);

      const vectors = await attempt(() => this.embedWithRetry(batch, batchNumber, totalBatches));
      if (vectors.ok) batch.forEach((chunk, i) => { chunk.vector = vectors.value[i] ?? []; });
      else logger.warn(`Skipping batch ${batchNumber}/${totalBatches}: ${errorMessage(vectors.error)}`);

      const isLastBatch = start + batchSize >= chunks.length;
      if (!isLastBatch) await this.sleep(delayMs);
    }
  }

  private embedWithRetry(batch: IndexedChunk[], batchNumber: number, totalBatches: number): Promise<number[][]> {
    return retryTransient(() => this.embedder.embedBatch(batch.map((chunk) => chunk.text)), {
      maxAttempts: EMBEDDING_MAX_ATTEMPTS,
      backoff: EMBEDDING_BACKOFF,
      sleep: this.sleep,
      onRetry: (attemptNumber, err, kind, delayMs) =>
        logger.info(`${kind} on batch ${batchNumber}/${totalBatches} — retry ${attemptNumber}/${EMBEDDING_MAX_ATTEMPTS} in ${delayMs}ms (${errorMessage(err)})`),
    });
  }

  private async saveIndexingResults(files: VaultEntry[], chunksByFile: Map<string, IndexedChunk[]>): Promise<void> {
    for (const entry of files) {
      const chunks = chunksByFile.get(entry.filePath) ?? [];
      await this.repository.save({
        filePath: entry.filePath,
        hash: computeContentHash(entry.content),
        chunkIds: chunks.map((chunk) => chunk.id),
        indexed: chunks.length > 0 && chunks.every((chunk) => chunk.vector.length > 0),
        content: entry.content,
      });
    }
  }
}
