import type {
  IndexedVersion,
  PagedResult,
  VaultEntry,
  VaultFolder,
  VaultRepository,
  VaultSearchCriteria,
  VaultStats,
  VaultVersion,
} from '../domain';
import { InMemoryVaultRepository } from './inMemoryVault.repository';

/**
 * Write-through RAM cache of the whole manifest (rows are small: ids and
 * state, no content). The service runs as ONE instance, so after a single
 * load every read — `/health` stats, browsing, the RAG read-side guard — costs
 * zero database queries and Neon can scale to zero. Writes go to the database
 * first and the returned rows update the cache.
 *
 * If the database is changed behind the app's back (SQL editor, reset
 * script), call `refresh()` (POST /api/vault/sync does) or restart.
 */
export class CachedVaultRepository implements VaultRepository {
  private readonly cache = new InMemoryVaultRepository();
  private loading: Promise<void> | null = null;
  private loaded = false;

  constructor(private readonly inner: VaultRepository) {}

  /** True once the manifest is in memory (the RAG guard passes everything through before that). */
  isLoaded(): boolean {
    return this.loaded;
  }

  /** Reloads everything (live + deleting rows) from the database: one or two queries. */
  async refresh(): Promise<void> {
    const [live, deleting] = await Promise.all([this.inner.findAll(), this.inner.findDeleting()]);
    this.cache.replaceAll([...live, ...deleting]);
    this.loaded = true;
  }

  /** Synchronous lookup by doc id; undefined when unknown or not loaded. */
  peekByDocId(docId: string): VaultEntry | undefined {
    return this.loaded ? this.cache.peekByDocId(docId) : undefined;
  }

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    await this.ensureLoaded();
    return this.cache.search(criteria);
  }

  async findAll(): Promise<VaultEntry[]> {
    await this.ensureLoaded();
    return this.cache.findAll();
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    await this.ensureLoaded();
    return this.cache.findByFolder(folder);
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    await this.ensureLoaded();
    return this.cache.findByPath(filePath);
  }

  async findDeleting(): Promise<VaultEntry[]> {
    await this.ensureLoaded();
    return this.cache.findDeleting();
  }

  async listFolders(): Promise<VaultFolder[]> {
    await this.ensureLoaded();
    return this.cache.listFolders();
  }

  async stats(): Promise<VaultStats> {
    await this.ensureLoaded();
    return this.cache.stats();
  }

  async saveVersion(version: VaultVersion): Promise<VaultEntry> {
    return this.track(await this.inner.saveVersion(version));
  }

  async commitIndexed(version: IndexedVersion): Promise<VaultEntry | null> {
    return this.trackOne(await this.inner.commitIndexed(version));
  }

  async markFailed(docId: string, hash: string, error: string): Promise<VaultEntry | null> {
    return this.trackOne(await this.inner.markFailed(docId, hash, error));
  }

  async rename(filePath: string, newPath: string): Promise<VaultEntry | null> {
    return this.trackOne(await this.inner.rename(filePath, newPath));
  }

  async markDeleting(filePath: string): Promise<VaultEntry | null> {
    return this.trackOne(await this.inner.markDeleting(filePath));
  }

  async markFolderDeleting(folder: string): Promise<VaultEntry[]> {
    const entries = await this.inner.markFolderDeleting(folder);
    if (this.loaded) this.cache.putEntries(entries);
    return entries;
  }

  async markAllDeleting(): Promise<VaultEntry[]> {
    const entries = await this.inner.markAllDeleting();
    if (this.loaded) this.cache.putEntries(entries);
    return entries;
  }

  async removeDeleted(docId: string): Promise<boolean> {
    const removed = await this.inner.removeDeleted(docId);
    if (removed && this.loaded) this.cache.deleteDoc(docId);
    return removed;
  }

  async removeAllDeleted(): Promise<number> {
    const removed = await this.inner.removeAllDeleted();
    if (this.loaded) for (const e of await this.cache.findDeleting()) this.cache.deleteDoc(e.docId);
    return removed;
  }

  private track(entry: VaultEntry): VaultEntry {
    if (this.loaded) this.cache.putEntries([entry]);
    return entry;
  }

  private trackOne(entry: VaultEntry | null): VaultEntry | null {
    return entry ? this.track(entry) : null;
  }

  private ensureLoaded(): Promise<void> {
    if (this.loaded) return Promise.resolve();
    if (!this.loading) {
      this.loading = this.refresh().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }
}
