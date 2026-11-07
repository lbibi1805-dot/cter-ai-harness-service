import * as crypto from 'crypto';
import { mapWithConcurrency } from '../../../shared/concurrency/mapWithConcurrency';
import { ConflictError, NotFoundError, ValidationError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { ObjectPrefix, type ObjectStorage } from '../../../shared/storage';
import {
  MARKDOWN_CONTENT_TYPE,
  VaultEntryStatus,
  VaultSourceType,
  VaultUploadOutcome,
  VectorSyncResult,
  chunkIdPrefix,
  computeContentHash,
  isVaultPathTooLong,
  needsIndexing,
  normalizeVaultContent,
  toVaultFilePath,
  vaultDocPrefixes,
  vaultObjectKey,
  type PagedResult,
  type VaultDocumentReader,
  type VaultEntry,
  type VaultFolder,
  type VaultIndexScheduler,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
  type VectorChunkMetadata,
  type VectorIndex,
} from '../domain';
import {
  Page,
  ChunkIdsResult,
  VaultUpload,
  VaultUploadResult,
  FileChunksResult,
  VaultFileView,
  VaultDeleteResult,
  ReconcileReport,
  VaultServiceOptions,
} from './interfaces/vault.interface';
import { DEFAULT_VAULT_SERVICE_OPTIONS, VAULT_OBJECT_METADATA } from './constants/vault.constants';

/**
 * Vault use cases. Neon (the manifest) is the source of truth; object storage
 * and the vector index are derived copies. Writes follow "write new → switch
 * pointer → clean old", so a crash leaves garbage at worst, never a pointer to
 * something missing; deletes are a committed `deleting` state finished
 * idempotently (here, or later by `reconcile`).
 */
export class VaultService {
  private readonly options: VaultServiceOptions;

  constructor(
    private readonly repository: VaultRepository,
    private readonly vectors: VectorIndex | null,
    private readonly storage: ObjectStorage,
    private readonly indexScheduler: VaultIndexScheduler = { scheduleAfterUpload: () => undefined },
    options: Partial<VaultServiceOptions> = {},
  ) {
    this.options = { ...DEFAULT_VAULT_SERVICE_OPTIONS, ...options };
  }

  isVectorIndexEnabled(): boolean {
    return this.vectors !== null;
  }

  searchFiles(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    return this.repository.search(criteria);
  }

  async getFile(filePath: string): Promise<VaultFileView> {
    const entry = await this.requireLiveEntry(filePath, 'Not found');
    return { ...entry, content: (await this.readContent(entry)) ?? '' };
  }

  listFolders(): Promise<VaultFolder[]> {
    return this.repository.listFolders();
  }

  stats(): Promise<VaultStats> {
    return this.repository.stats();
  }

  /** The document reader used by the indexer, `read_document` and the API. Verifies the stored sha256. */
  readonly documents: VaultDocumentReader = {
    readContent: (entry) => this.readContent(entry),
  };

  async readContent(entry: Pick<VaultEntry, 'objectKey' | 'filePath'>): Promise<string | null> {
    if (!entry.objectKey) return null;
    const object = await this.storage.get(entry.objectKey);
    if (!object) {
      logger.warn(`[vault] object missing for ${entry.filePath} (${entry.objectKey})`);
      return null;
    }
    const expected = object.metadata.sha256;
    if (expected && expected !== crypto.createHash('sha256').update(object.body).digest('hex')) {
      logger.warn(`[vault] sha256 mismatch for ${entry.filePath} (${entry.objectKey}) — treating as missing`);
      return null;
    }
    return object.body.toString('utf-8');
  }

  async readDocument(filePath: string): Promise<string | null> {
    const entry = await this.repository.findByPath(filePath);
    if (!entry || entry.status === VaultEntryStatus.DELETING) return null;
    return this.readContent(entry);
  }

  async listChunkIds(page: Page): Promise<ChunkIdsResult> {
    const entries = await this.repository.findAll();
    const allIds = entries.flatMap((entry) => entry.chunkIds);
    return { total: allIds.length, chunkIds: allIds.slice(page.offset, page.offset + page.limit) };
  }

  /** Chunk ids of one file, enriched with vector metadata when the file is indexed. */
  async getFileChunks(filePath: string, page: Page): Promise<FileChunksResult> {
    const entry = await this.requireLiveEntry(filePath, 'File not found');
    const pagedIds = entry.chunkIds.slice(page.offset, page.offset + page.limit);
    const metadata = entry.indexed ? await this.fetchMetadataSafely(pagedIds) : {};
    const chunks = pagedIds.map((id, i) => ({ id, index: page.offset + i, indexed: entry.indexed, ...(metadata[id] ?? {}) }));
    return { total: entry.chunkIds.length, chunks };
  }

  /**
   * Same content as stored (md5 of the normalized text) → nothing happens: no
   * object put, no re-embedding. New content → object under a new
   * content-addressed key, then the manifest points at it.
   */
  async uploadFiles(uploads: VaultUpload[]): Promise<VaultUploadResult[]> {
    const results: VaultUploadResult[] = [];
    let scheduleIndex = false;
    for (const upload of uploads) {
      const filePath = toVaultFilePath(upload.rawName);
      if (isVaultPathTooLong(filePath)) {
        results.push({ file: filePath, error: 'path too long' });
        continue;
      }
      if (upload.content.trim().length === 0) {
        results.push({ file: filePath, error: 'empty file' });
        continue;
      }
      const stored = await attempt(() => this.uploadOne(filePath, upload.content));
      if (!stored.ok) {
        logger.warn(`[vault] upload failed for ${filePath}: ${errorMessage(stored.error)}`);
        results.push({ file: filePath, error: errorMessage(stored.error) });
        continue;
      }
      results.push(stored.value.result);
      scheduleIndex ||= stored.value.needsIndex;
    }
    if (scheduleIndex) this.indexScheduler.scheduleAfterUpload();
    return results;
  }

  /** Renames a file: only `file_path` changes (0 embeddings, 0 object writes). */
  async renameFile(filePath: string, rawNewPath: string): Promise<VaultEntry> {
    const newPath = toVaultFilePath(rawNewPath.trim());
    if (!newPath || isVaultPathTooLong(newPath)) throw new ValidationError('Invalid new path');
    if (newPath === filePath) return this.requireLiveEntry(filePath, 'Not found');
    const renamed = await this.repository.rename(filePath, newPath);
    if (!renamed) throw new NotFoundError('Not found');
    logger.info(`[vault] renamed ${filePath} → ${newPath}`);
    return renamed;
  }

  async deleteFile(filePath: string): Promise<VaultDeleteResult> {
    await this.requireLiveEntry(filePath, 'Not found');
    const marked = await this.repository.markDeleting(filePath);
    if (!marked) throw new NotFoundError('Not found');
    const done = await this.purgeDocument(marked);
    return { deleted: 1, pending: done ? 0 : 1, vectors: this.vectors ? (done ? VectorSyncResult.OK : VectorSyncResult.PARTIAL) : VectorSyncResult.SKIP };
  }

  async deleteFolder(folder: string): Promise<VaultDeleteResult> {
    const marked = await this.repository.markFolderDeleting(folder);
    if (marked.length === 0) throw new NotFoundError('Folder not found or empty');
    const outcomes = await mapWithConcurrency(marked, this.options.deleteConcurrency, (entry) => this.purgeDocument(entry));
    const pending = outcomes.filter((done) => !done).length;
    return { deleted: marked.length, pending, vectors: this.vectors ? (pending ? VectorSyncResult.PARTIAL : VectorSyncResult.OK) : VectorSyncResult.SKIP };
  }

  /** Clears the whole vault: vectors and objects by prefix (cheap), then the rows. */
  async deleteAll(): Promise<VaultDeleteResult> {
    const marked = await this.repository.markAllDeleting();
    let ok = true;
    const vectors = this.vectors;
    if (vectors) {
      const cleared = await attempt(() => vectors.deleteAll());
      if (!cleared.ok) {
        ok = false;
        logger.warn(`[vault] vector index clear failed: ${errorMessage(cleared.error)}`);
      }
    }
    for (const prefix of [ObjectPrefix.VAULT, ObjectPrefix.DERIVED]) {
      const removed = await attempt(() => this.storage.deletePrefix(prefix));
      if (!removed.ok) {
        ok = false;
        logger.warn(`[vault] object prefix ${prefix} delete failed: ${errorMessage(removed.error)}`);
      }
    }
    // The delete is committed (`deleting`): a failure from here on only leaves work for reconcile.
    if (ok) {
      const removed = await attempt(() => this.repository.removeAllDeleted());
      if (!removed.ok) {
        ok = false;
        logger.warn(`[vault] manifest cleanup failed: ${errorMessage(removed.error)}`);
      }
    }
    logger.info(`[vault] clear all: ${marked.length} files${ok ? '' : ' (cleanup pending — run /api/vault/sync)'}`);
    return { deleted: marked.length, pending: ok ? 0 : marked.length, vectors: vectors ? (ok ? VectorSyncResult.OK : VectorSyncResult.PARTIAL) : VectorSyncResult.SKIP };
  }

  /**
   * Steps 2–4 of a delete for a row already committed as `deleting`. Every
   * step is idempotent; returns false when something failed (the row stays
   * `deleting` and a later run finishes it).
   */
  async purgeDocument(entry: VaultEntry): Promise<boolean> {
    let ok = true;
    const vectors = this.vectors;
    if (vectors) {
      const ids = new Set(entry.chunkIds);
      const listed = await attempt(() => vectors.listIds(chunkIdPrefix(entry.docId)));
      if (listed.ok) listed.value.forEach((id) => ids.add(id));
      else logger.warn(`[vault] cannot list vectors of ${entry.docId} (${errorMessage(listed.error)}) — deleting known ids only`);
      if (ids.size > 0) {
        const deleted = await attempt(() => vectors.deleteByIds([...ids]));
        if (!deleted.ok) {
          ok = false;
          logger.warn(`[vault] vector delete failed for ${entry.filePath}: ${errorMessage(deleted.error)} — will retry`);
        }
      }
    }
    for (const prefix of vaultDocPrefixes(entry.docId)) {
      const removed = await attempt(() => this.storage.deletePrefix(prefix));
      if (!removed.ok) {
        ok = false;
        logger.warn(`[vault] object delete failed for ${prefix}: ${errorMessage(removed.error)} — will retry`);
      }
    }
    if (!ok) return false;
    const removed = await attempt(() => this.repository.removeDeleted(entry.docId));
    if (!removed.ok) {
      logger.warn(`[vault] manifest row delete failed for ${entry.filePath}: ${errorMessage(removed.error)}`);
      return false;
    }
    logger.info(`[vault] deleted ${entry.filePath} (${entry.chunkIds.length} vectors, objects under vault/${entry.docId}/)`);
    return true;
  }

  /**
   * Garbage collection: finishes pending deletes, removes vectors and objects
   * nothing points to, re-queues files whose latest content is not indexed.
   * Must run while no indexing run is active (see VaultIndexingService.runExclusive).
   */
  async reconcile(): Promise<ReconcileReport> {
    const report: ReconcileReport = { deletesResumed: 0, deletesStillPending: 0, orphanVectorsDeleted: 0, orphanObjectsDeleted: 0, pendingIndex: 0, legacyRows: 0, skipped: [] };

    const deleting = await this.repository.findDeleting();
    const outcomes = await mapWithConcurrency(deleting, this.options.deleteConcurrency, (entry) => this.purgeDocument(entry));
    report.deletesResumed = outcomes.filter(Boolean).length;
    report.deletesStillPending = outcomes.length - report.deletesResumed;

    const live = await this.repository.findAll();
    report.legacyRows = live.filter((e) => !e.objectKey).length;
    await this.collectOrphanVectors(live, report);
    await this.collectOrphanObjects(live, report);

    report.pendingIndex = live.filter(needsIndexing).length;
    if (report.pendingIndex > 0) this.indexScheduler.scheduleAfterUpload();
    logger.info(`[vault] reconcile: ${JSON.stringify(report)}`);
    return report;
  }

  private async uploadOne(filePath: string, rawContent: string): Promise<{ result: VaultUploadResult; needsIndex: boolean }> {
    const content = normalizeVaultContent(rawContent);
    const hash = computeContentHash(content);
    let existing = await this.repository.findByPath(filePath);

    if (existing?.status === VaultEntryStatus.DELETING) {
      // A failed delete is still pending on this path: finish it before reusing the path.
      if (!(await this.purgeDocument(existing))) throw new ConflictError('previous delete of this file is still pending — retry later');
      existing = null;
    }
    if (existing && existing.hash === hash && existing.objectKey) {
      return { result: { file: filePath, hash, indexed: existing.indexed, outcome: VaultUploadOutcome.UNCHANGED }, needsIndex: needsIndexing(existing) };
    }

    const docId = existing?.docId ?? crypto.randomUUID();
    const objectKey = vaultObjectKey(docId, hash);
    const bytes = Buffer.from(content, 'utf-8');
    await this.storage.put(objectKey, bytes, {
      contentType: MARKDOWN_CONTENT_TYPE,
      metadata: { [VAULT_OBJECT_METADATA.DOC_ID]: docId, [VAULT_OBJECT_METADATA.CONTENT_HASH]: hash },
    });
    await this.repository.saveVersion({
      filePath,
      docId,
      hash,
      objectKey,
      sourceType: VaultSourceType.MARKDOWN,
      contentType: MARKDOWN_CONTENT_TYPE,
      sizeBytes: bytes.length,
    });
    // The manifest no longer points at the previous object: drop it now (the reconciler catches a failure).
    if (existing?.objectKey && existing.objectKey !== objectKey) {
      const previous = existing.objectKey;
      const dropped = await attempt(() => this.storage.delete(previous));
      if (!dropped.ok) logger.warn(`[vault] could not delete previous object ${previous}: ${errorMessage(dropped.error)}`);
    }
    const outcome = existing ? VaultUploadOutcome.UPDATED : VaultUploadOutcome.CREATED;
    return { result: { file: filePath, hash, indexed: false, outcome }, needsIndex: true };
  }

  private async collectOrphanVectors(live: VaultEntry[], report: ReconcileReport): Promise<void> {
    const vectors = this.vectors;
    if (!vectors) return;
    const listed = await attempt(() => vectors.listIds());
    if (!listed.ok) {
      report.skipped.push(`vectors: ${errorMessage(listed.error)}`);
      return;
    }
    const valid = new Set(live.flatMap((e) => e.chunkIds));
    const orphans = listed.value.filter((id) => !valid.has(id));
    if (orphans.length === 0) return;
    const deleted = await attempt(() => vectors.deleteByIds(orphans));
    if (deleted.ok) report.orphanVectorsDeleted = orphans.length;
    else report.skipped.push(`vector delete: ${errorMessage(deleted.error)}`);
  }

  private async collectOrphanObjects(live: VaultEntry[], report: ReconcileReport): Promise<void> {
    const validKeys = new Set(live.map((e) => e.objectKey).filter(Boolean));
    const liveDocs = new Set(live.map((e) => e.docId));
    const cutoff = this.options.now() - this.options.orphanGraceMs;
    const isOld = (lastModified?: Date): boolean => !lastModified || lastModified.getTime() < cutoff;

    const listed = await attempt(async () => [...(await this.storage.list(ObjectPrefix.VAULT)), ...(await this.storage.list(ObjectPrefix.DERIVED))]);
    if (!listed.ok) {
      report.skipped.push(`objects: ${errorMessage(listed.error)}`);
      return;
    }
    const orphans = listed.value.filter((o) => {
      if (!isOld(o.lastModified)) return false;
      if (o.key.startsWith(ObjectPrefix.VAULT)) return !validKeys.has(o.key);
      const docId = o.key.slice(ObjectPrefix.DERIVED.length).split('/')[0];
      return !liveDocs.has(docId);
    }).map((o) => o.key);
    if (orphans.length === 0) return;
    const deleted = await attempt(() => this.storage.deleteMany(orphans));
    if (deleted.ok) report.orphanObjectsDeleted = orphans.length;
    else report.skipped.push(`object delete: ${errorMessage(deleted.error)}`);
  }

  private async requireLiveEntry(filePath: string, notFoundMessage: string): Promise<VaultEntry> {
    const entry = await this.repository.findByPath(filePath);
    if (!entry || entry.status === VaultEntryStatus.DELETING) throw new NotFoundError(notFoundMessage);
    return entry;
  }

  private async fetchMetadataSafely(ids: string[]): Promise<Record<string, VectorChunkMetadata>> {
    const vectors = this.vectors;
    if (!vectors || ids.length === 0) return {};
    const fetched = await attempt(() => vectors.fetchMetadata(ids));
    return fetched.ok ? fetched.value : {};
  }
}
