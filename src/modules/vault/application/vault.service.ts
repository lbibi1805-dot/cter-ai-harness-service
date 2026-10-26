import { NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { normalizeText } from '../../retrieval/domain/textNormalizer';
import {
  VectorSyncResult,
  computeContentHash,
  isVaultPathTooLong,
  toVaultFilePath,
  type PagedResult,
  type VaultDocumentStore,
  type VaultEntry,
  type VaultFolder,
  type VaultIndexScheduler,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
  type VectorChunkMetadata,
  type VectorIndex,
} from '../domain';
import { Page, ChunkIdsResult, VaultUpload, VaultUploadResult, FileChunksResult } from './interfaces/vault.interface';
import { RECONCILE_ALL_VECTORS_DELETED } from './constants/vault.constants';

/** Vault use cases: browsing, uploading and deleting files, keeping the vector index in sync. */
export class VaultService {
  constructor(
    private readonly repository: VaultRepository,
    private readonly vectors: VectorIndex | null,
    private readonly documents: VaultDocumentStore,
    private readonly indexScheduler: VaultIndexScheduler = { scheduleAfterUpload: () => undefined },
  ) {}

  isVectorIndexEnabled(): boolean {
    return this.vectors !== null;
  }

  searchFiles(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    return this.repository.search(criteria);
  }

  async getFile(filePath: string): Promise<VaultEntry> {
    return this.requireEntry(filePath, 'Not found');
  }

  listFolders(): Promise<VaultFolder[]> {
    return this.repository.listFolders();
  }

  stats(): Promise<VaultStats> {
    return this.repository.stats();
  }

  async listChunkIds(page: Page): Promise<ChunkIdsResult> {
    const entries = await this.repository.findAll();
    const allIds = entries.flatMap((entry) => entry.chunkIds);
    return { total: allIds.length, chunkIds: allIds.slice(page.offset, page.offset + page.limit) };
  }

  /** Chunk ids of one file, enriched with vector metadata when the file is indexed. */
  async getFileChunks(filePath: string, page: Page): Promise<FileChunksResult> {
    const entry = await this.requireEntry(filePath, 'File not found');

    const pagedIds = entry.chunkIds.slice(page.offset, page.offset + page.limit);
    const metadata = entry.indexed ? await this.fetchMetadataSafely(pagedIds) : {};
    const chunks = pagedIds.map((id, i) => ({
      id,
      index: page.offset + i,
      indexed: entry.indexed,
      ...(metadata[id] ?? {}),
    }));
    return { total: entry.chunkIds.length, chunks };
  }

  async uploadFiles(uploads: VaultUpload[]): Promise<VaultUploadResult[]> {
    const results: VaultUploadResult[] = [];
    for (const upload of uploads) {
      const filePath = toVaultFilePath(upload.rawName);
      if (isVaultPathTooLong(filePath)) {
        results.push({ file: filePath, error: 'path too long' });
        continue;
      }
      const hash = computeContentHash(upload.content);
      await this.documents.write(filePath, upload.content);
      await this.repository.save({
        filePath,
        hash,
        chunkIds: [],
        indexed: false,
        content: normalizeText(upload.content),
      });
      results.push({ file: filePath, hash, indexed: false });
    }
    if (uploads.length > 0) this.indexScheduler.scheduleAfterUpload();
    return results;
  }

  async deleteFile(filePath: string): Promise<VectorSyncResult> {
    const entry = await this.requireEntry(filePath, 'Not found');

    const syncResult = await this.deleteEntryVectors(entry);
    await this.repository.remove(filePath);
    await this.documents.remove([filePath]);
    return syncResult;
  }

  /** Returns the number of deleted files. */
  async deleteFolder(folder: string): Promise<number> {
    const entries = await this.repository.findByFolder(folder);
    if (entries.length === 0) throw new NotFoundError('Folder not found or empty');

    await this.deleteVectorsSafely(entries.flatMap((entry) => entry.chunkIds));
    for (const entry of entries) await this.repository.remove(entry.filePath);
    await this.documents.remove(entries.map((entry) => entry.filePath));
    return entries.length;
  }

  async deleteAll(): Promise<number> {
    const entries = await this.repository.findAll();
    await this.clearVectorIndex();
    await this.repository.removeAll();
    await this.documents.remove(entries.map((entry) => entry.filePath));
    return entries.length;
  }

  /** Manual reconcile (admin API): only meaningful when a vector index is configured. */
  async syncVectorIndex(): Promise<number> {
    if (!this.isVectorIndexEnabled()) throw new ValidationError('vault not configured');
    return this.reconcileVectors();
  }

  /**
   * Removes orphan vectors after the manifest was cleared outside the app
   * (e.g. SQL editor). Only the "manifest empty" case can be detected cheaply.
   */
  async reconcileVectors(): Promise<number> {
    if (!this.vectors) return 0;
    const { total } = await this.repository.stats();
    if (total > 0) return 0;
    const vectors = this.vectors;
    const cleared = await attempt(() => vectors.deleteAll());
    if (!cleared.ok) {
      logger.warn(`[vault] reconcile failed: ${errorMessage(cleared.error)}`);
      return 0;
    }
    logger.info('[vault] reconcile: manifest empty → vector index cleared');
    return RECONCILE_ALL_VECTORS_DELETED;
  }

  /** The manifest is the source of truth: a failed vector wipe is logged, not fatal. */
  private async clearVectorIndex(): Promise<void> {
    const vectors = this.vectors;
    if (!vectors) return;
    const cleared = await attempt(() => vectors.deleteAll());
    if (cleared.ok) logger.info('[vault] vector index cleared');
    else logger.warn(`[vault] vector index clear failed: ${errorMessage(cleared.error)}`);
  }

  private async requireEntry(filePath: string, notFoundMessage: string): Promise<VaultEntry> {
    const entry = await this.repository.findByPath(filePath);
    if (!entry) throw new NotFoundError(notFoundMessage);
    return entry;
  }

  private async deleteEntryVectors(entry: VaultEntry): Promise<VectorSyncResult> {
    const vectors = this.vectors;
    if (!vectors || entry.chunkIds.length === 0) return VectorSyncResult.SKIP;
    const deleted = await attempt(() => vectors.deleteByIds(entry.chunkIds));
    if (!deleted.ok) {
      logger.warn(`[vault] vector delete failed for ${entry.filePath}: ${errorMessage(deleted.error)} — orphaned, reconcile later`);
      return VectorSyncResult.PARTIAL;
    }
    logger.info(`[vault] deleted ${entry.chunkIds.length} vectors for ${entry.filePath}`);
    return VectorSyncResult.OK;
  }

  private async deleteVectorsSafely(ids: string[]): Promise<void> {
    const vectors = this.vectors;
    if (!vectors || ids.length === 0) return;
    const deleted = await attempt(() => vectors.deleteByIds(ids));
    if (!deleted.ok) logger.warn(`[vault] vector delete failed for ${ids.length} chunks: ${errorMessage(deleted.error)}`);
  }

  private async fetchMetadataSafely(ids: string[]): Promise<Record<string, VectorChunkMetadata>> {
    const vectors = this.vectors;
    if (!vectors || ids.length === 0) return {};
    const fetched = await attempt(() => vectors.fetchMetadata(ids));
    return fetched.ok ? fetched.value : {};
  }
}
