import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { sleep as realSleep, retryTransient } from '../../../shared/resilience/retry';
import {
  chunkId,
  computeContentHash,
  hasStoredObject,
  needsIndexing,
  type VaultDocumentReader,
  type VaultEntry,
  type VaultIndexRunReport,
  type VaultRepository,
} from '../../vault/domain';
import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { chunkDocument } from '../domain/markdownChunker';
import { EMBEDDING_BACKOFF, EMBEDDING_MAX_ATTEMPTS } from '../domain/constants/retrieval.constants';
import type { IndexedChunk } from '../domain/interfaces/retrieval.interface';
import { normalizeText } from '../domain/textNormalizer';
import type { VectorStore } from '../domain/interfaces/vectorStore.port';
import { Sleep } from '../../../shared/resilience/interfaces/retry.interface';
import { EMPTY_FILES_PREVIEW } from './constants/knowledgeIndexer.constants';
import { IndexingSettings } from './interfaces/knowledgeIndexer.interface';

/**
 * Brings Pinecone in line with the manifest, one file at a time (bounded
 * memory): read the latest content from object storage, chunk with ids
 * `<docId>#<hash8>#<idx>`, embed, upsert, then switch the manifest to the new
 * version and only after that delete the previous vectors. The previous
 * version stays searchable until the switch; a failure marks the file
 * `failed` and leaves the previous version live.
 */
export class KnowledgeIndexer {
  private batchesSent = 0;

  constructor(
    private readonly settings: IndexingSettings,
    private readonly embedder: EmbeddingService,
    private readonly repository: VaultRepository,
    private readonly vectorStore: VectorStore,
    private readonly documents: VaultDocumentReader,
    private readonly sleep: Sleep = realSleep,
  ) {}

  async indexAll(): Promise<VaultIndexRunReport> {
    await this.prepareIndex();
    const entries = await this.repository.findAll();
    if (entries.length === 0) {
      logger.info('Vault empty — nothing to index');
      return { indexed: 0, failed: 0 };
    }
    this.reportLegacyRows(entries.filter((e) => !hasStoredObject(e)).map((e) => e.filePath));

    const pending = entries.filter(needsIndexing);
    if (pending.length === 0) {
      logger.info(`All ${entries.length} vault files indexed — skipping`);
      return { indexed: 0, failed: 0 };
    }

    logger.info(`Vault: ${entries.length} files, indexing ${pending.length} (provider=${this.settings.embeddingProvider}, batch=${this.settings.embeddingBatchSize})`);
    let indexed = 0;
    let failed = 0;
    for (const entry of pending) {
      const result = await attempt(() => this.indexOne(entry));
      if (result.ok && result.value) {
        indexed++;
        continue;
      }
      failed++;
      const reason = result.ok ? 'not committed' : errorMessage(result.error);
      logger.warn(`[index] ${entry.filePath} failed: ${reason}`);
      if (!result.ok) await attempt(() => this.repository.markFailed(entry.docId, entry.hash, reason));
    }
    logger.info(`Vault indexing complete — ${indexed} indexed, ${failed} failed`);
    return { indexed, failed };
  }

  /** Returns true when the new version is live. Throws (→ `failed`) on any error. */
  private async indexOne(entry: VaultEntry): Promise<boolean> {
    const content = await this.documents.readContent(entry);
    if (content === null) throw new Error(`object missing: ${entry.objectKey}`);
    if (computeContentHash(content) !== entry.hash) throw new Error('stored content does not match the manifest hash');
    if (!content.trim()) throw new Error('empty content');

    let index = 0;
    const chunks = chunkDocument(entry.filePath, normalizeText(content), () => chunkId(entry.docId, entry.hash, index++))
      .map((chunk) => ({ ...chunk, docId: entry.docId, contentHash: entry.hash }));
    await this.embedChunks(chunks);
    const missing = chunks.filter((chunk) => chunk.vector.length === 0).length;
    if (missing > 0) throw new Error(`embedding failed for ${missing}/${chunks.length} chunks`);

    await this.vectorStore.upsertChunks(chunks);
    const newIds = chunks.map((chunk) => chunk.id);
    const committed = await this.repository.commitIndexed({ docId: entry.docId, hash: entry.hash, chunkIds: newIds });
    if (!committed) {
      // The file changed or is being deleted meanwhile: these vectors are already stale.
      await this.deleteQuietly(newIds, `stale vectors of ${entry.filePath}`);
      logger.info(`[index] ${entry.filePath} changed during indexing — skipped (next run picks up the new version)`);
      return true;
    }
    const fresh = new Set(newIds);
    await this.deleteQuietly(entry.chunkIds.filter((id) => !fresh.has(id)), `previous vectors of ${entry.filePath}`);
    logger.info(`[index] ${entry.filePath}: ${chunks.length} chunks live`);
    return true;
  }

  /** Pinecone being down must not block startup: files simply stay pending. */
  private async prepareIndex(): Promise<void> {
    const ready = await attempt(() => this.vectorStore.ensureIndex(this.embedder.dimension));
    if (!ready.ok) logger.warn(`Pinecone unavailable — indexing will fail and be retried (${errorMessage(ready.error)})`);
  }

  private reportLegacyRows(paths: string[]): void {
    if (paths.length === 0) return;
    const preview = paths.slice(0, EMPTY_FILES_PREVIEW).join(', ');
    const more = paths.length > EMPTY_FILES_PREVIEW ? '…' : '';
    logger.info(`Vault has ${paths.length} legacy files without a stored object (run the vault reset + re-upload): ${preview}${more}`);
  }

  /** Best effort: leftovers are filtered by the read-side guard and removed by reconcile. */
  private async deleteQuietly(ids: string[], label: string): Promise<void> {
    if (ids.length === 0) return;
    const deleted = await attempt(() => this.vectorStore.deleteByIds(ids));
    if (!deleted.ok) logger.warn(`Could not delete ${label}: ${errorMessage(deleted.error)} — reconcile will retry`);
  }

  /** Fills `chunk.vector` in place; a batch that keeps failing is left empty. */
  private async embedChunks(chunks: IndexedChunk[]): Promise<void> {
    const { embeddingBatchSize: batchSize, embeddingDelayMs: delayMs } = this.settings;
    const totalBatches = Math.ceil(chunks.length / batchSize);
    for (let start = 0; start < chunks.length; start += batchSize) {
      if (this.batchesSent++ > 0) await this.sleep(delayMs);
      const batch = chunks.slice(start, start + batchSize);
      const batchNumber = start / batchSize + 1;
      const vectors = await attempt(() => this.embedWithRetry(batch, batchNumber, totalBatches));
      if (vectors.ok) batch.forEach((chunk, i) => { chunk.vector = vectors.value[i] ?? []; });
      else logger.warn(`Skipping batch ${batchNumber}/${totalBatches}: ${errorMessage(vectors.error)}`);
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
}
