import { normalizeText } from '../../../rag/textNormalizer';
import { logger } from '../../../utils/logger';
import {
  VectorSyncResult,
  computeContentHash,
  isVaultPathTooLong,
  toVaultFilePath,
  type PagedResult,
  type VaultDocumentStore,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
  type VectorChunkMetadata,
  type VectorIndex,
} from '../domain';

/** Returned by `reconcileVectors` when the whole vector index was wiped. */
export const RECONCILE_ALL_VECTORS_DELETED = -1;

export interface Page {
  limit: number;
  offset: number;
}

export interface VaultUpload {
  rawName: string;
  content: string;
}

export type VaultUploadResult =
  | { file: string; hash: string; indexed: false }
  | { file: string; error: string };

export interface VaultChunkView extends Partial<VectorChunkMetadata> {
  id: string;
  index: number;
  indexed: boolean;
}

export interface FileChunksResult {
  total: number;
  chunks: VaultChunkView[];
}

export interface ChunkIdsResult {
  total: number;
  chunkIds: string[];
}

/** Vault use cases: browsing, uploading and deleting files, keeping the vector index in sync. */
export class VaultService {
  constructor(
    private readonly repository: VaultRepository,
    private readonly vectors: VectorIndex | null,
    private readonly documents: VaultDocumentStore,
  ) {}

  isVectorIndexEnabled(): boolean {
    return this.vectors !== null;
  }

  searchFiles(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    return this.repository.search(criteria);
  }

  getFile(filePath: string): Promise<VaultEntry | null> {
    return this.repository.findByPath(filePath);
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
  async getFileChunks(filePath: string, page: Page): Promise<FileChunksResult | null> {
    const entry = await this.repository.findByPath(filePath);
    if (!entry) return null;

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
    return results;
  }

  /** Returns null when the file does not exist. */
  async deleteFile(filePath: string): Promise<VectorSyncResult | null> {
    const entry = await this.repository.findByPath(filePath);
    if (!entry) return null;

    const syncResult = await this.deleteEntryVectors(entry);
    await this.repository.remove(filePath);
    await this.documents.remove([filePath]);
    return syncResult;
  }

  /** Returns the number of deleted files (0 when the folder is empty or missing). */
  async deleteFolder(folder: string): Promise<number> {
    const entries = await this.repository.findByFolder(folder);
    if (entries.length === 0) return 0;

    await this.deleteVectorsSafely(entries.flatMap((entry) => entry.chunkIds));
    for (const entry of entries) await this.repository.remove(entry.filePath);
    await this.documents.remove(entries.map((entry) => entry.filePath));
    return entries.length;
  }

  async deleteAll(): Promise<number> {
    const entries = await this.repository.findAll();
    if (this.vectors) {
      try {
        await this.vectors.deleteAll();
        logger.info('[vault] vector index cleared');
      } catch (err) {
        logger.info(`[vault] vector index clear failed: ${(err as Error).message}`);
      }
    }
    await this.repository.removeAll();
    await this.documents.remove(entries.map((entry) => entry.filePath));
    return entries.length;
  }

  /**
   * Removes orphan vectors after the manifest was cleared outside the app
   * (e.g. SQL editor). Only the "manifest empty" case can be detected cheaply.
   */
  async reconcileVectors(): Promise<number> {
    if (!this.vectors) return 0;
    const { total } = await this.repository.stats();
    if (total > 0) return 0;
    try {
      await this.vectors.deleteAll();
      logger.info('[vault] reconcile: manifest empty → vector index cleared');
      return RECONCILE_ALL_VECTORS_DELETED;
    } catch (err) {
      logger.info(`[vault] reconcile failed: ${(err as Error).message}`);
      return 0;
    }
  }

  private async deleteEntryVectors(entry: VaultEntry): Promise<VectorSyncResult> {
    if (!this.vectors || entry.chunkIds.length === 0) return VectorSyncResult.SKIP;
    try {
      await this.vectors.deleteByIds(entry.chunkIds);
      logger.info(`[vault] deleted ${entry.chunkIds.length} vectors for ${entry.filePath}`);
      return VectorSyncResult.OK;
    } catch (err) {
      logger.info(`[vault] vector delete failed for ${entry.filePath}: ${(err as Error).message} — orphaned, reconcile later`);
      return VectorSyncResult.PARTIAL;
    }
  }

  private async deleteVectorsSafely(ids: string[]): Promise<void> {
    if (!this.vectors || ids.length === 0) return;
    try {
      await this.vectors.deleteByIds(ids);
    } catch (err) {
      logger.info(`[vault] vector delete failed for ${ids.length} chunks: ${(err as Error).message}`);
    }
  }

  private async fetchMetadataSafely(ids: string[]): Promise<Record<string, VectorChunkMetadata>> {
    if (!this.vectors || ids.length === 0) return {};
    try {
      return await this.vectors.fetchMetadata(ids);
    } catch {
      return {};
    }
  }
}
