import { ConflictError } from '../../../shared/errors';
import {
  VaultEntryStatus,
  depthOf,
  folderPathOf,
  summarizeFolders,
  type IndexedVersion,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
  type VaultVersion,
} from '../domain';
import { isInFolder } from './helpers/fileVault.helper';

/**
 * The manifest in process memory, with the same semantics as the Neon
 * repository. Used directly by tests, as the read cache of
 * `CachedVaultRepository`, and (with persistence) as the JSON dev fallback.
 */
export class InMemoryVaultRepository implements VaultRepository {
  protected files = new Map<string, VaultEntry>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    let entries = this.visible();
    if (criteria.folder) entries = entries.filter((e) => isInFolder(e.filePath, criteria.folder!));
    if (criteria.text) {
      const needle = criteria.text.toLowerCase();
      entries = entries.filter((e) => e.filePath.toLowerCase().includes(needle));
    }
    if (typeof criteria.indexed === 'boolean') entries = entries.filter((e) => e.indexed === criteria.indexed);
    return { items: entries.slice(criteria.offset, criteria.offset + criteria.limit), total: entries.length };
  }

  async findAll(): Promise<VaultEntry[]> {
    return this.visible();
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    return this.visible().filter((e) => isInFolder(e.filePath, folder));
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    return this.copy(this.files.get(filePath));
  }

  async findDeleting(): Promise<VaultEntry[]> {
    return this.all().filter((e) => e.status === VaultEntryStatus.DELETING);
  }

  async listFolders(): Promise<VaultFolder[]> {
    const counts = new Map<string, number>();
    for (const entry of this.visible()) {
      const folder = folderPathOf(entry.filePath);
      if (folder) counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return summarizeFolders([...counts.entries()].map(([folderPath, fileCount]) => ({ folderPath, fileCount })));
  }

  async stats(): Promise<VaultStats> {
    const visible = this.visible();
    return { total: visible.length, indexed: visible.filter((e) => e.indexed).length };
  }

  async saveVersion(version: VaultVersion): Promise<VaultEntry> {
    const existing = this.files.get(version.filePath);
    const entry: VaultEntry = {
      filePath: version.filePath,
      docId: existing?.docId ?? version.docId,
      hash: version.hash,
      objectKey: version.objectKey,
      chunkIds: existing?.chunkIds ?? [],
      indexed: false,
      indexedHash: existing?.indexedHash ?? null,
      status: VaultEntryStatus.INDEXING,
      sourceType: version.sourceType,
      contentType: version.contentType,
      sizeBytes: version.sizeBytes,
      lastError: null,
      updatedAt: this.now().toISOString(),
      folderPath: folderPathOf(version.filePath),
      depth: depthOf(version.filePath),
    };
    this.files.set(entry.filePath, entry);
    this.changed();
    return { ...entry };
  }

  async commitIndexed(version: IndexedVersion): Promise<VaultEntry | null> {
    return this.updateWhere(
      (e) => e.docId === version.docId && e.hash === version.hash && e.status !== VaultEntryStatus.DELETING,
      (e) => ({ ...e, chunkIds: [...version.chunkIds], indexedHash: version.hash, indexed: true, status: VaultEntryStatus.ACTIVE, lastError: null }),
    );
  }

  async markFailed(docId: string, hash: string, error: string): Promise<VaultEntry | null> {
    return this.updateWhere(
      (e) => e.docId === docId && e.hash === hash && e.status !== VaultEntryStatus.DELETING,
      (e) => ({ ...e, status: VaultEntryStatus.FAILED, lastError: error }),
    );
  }

  async rename(filePath: string, newPath: string): Promise<VaultEntry | null> {
    const entry = this.files.get(filePath);
    if (!entry || entry.status === VaultEntryStatus.DELETING) return null;
    if (this.files.has(newPath)) throw new ConflictError(`A file already exists at ${newPath}`);
    this.files.delete(filePath);
    const renamed = { ...entry, filePath: newPath, folderPath: folderPathOf(newPath), depth: depthOf(newPath), updatedAt: this.now().toISOString() };
    this.files.set(newPath, renamed);
    this.changed();
    return { ...renamed };
  }

  async markDeleting(filePath: string): Promise<VaultEntry | null> {
    const entry = this.files.get(filePath);
    if (!entry) return null;
    return this.setDeleting([entry])[0];
  }

  async markFolderDeleting(folder: string): Promise<VaultEntry[]> {
    return this.setDeleting(this.all().filter((e) => isInFolder(e.filePath, folder)));
  }

  async markAllDeleting(): Promise<VaultEntry[]> {
    return this.setDeleting(this.all());
  }

  async removeDeleted(docId: string): Promise<boolean> {
    const entry = this.all().find((e) => e.docId === docId && e.status === VaultEntryStatus.DELETING);
    if (!entry) return false;
    this.files.delete(entry.filePath);
    this.changed();
    return true;
  }

  async removeAllDeleted(): Promise<number> {
    const deleting = await this.findDeleting();
    for (const e of deleting) this.files.delete(e.filePath);
    if (deleting.length > 0) this.changed();
    return deleting.length;
  }

  // ── cache maintenance (used by CachedVaultRepository) ──

  replaceAll(entries: VaultEntry[]): void {
    this.files = new Map(entries.map((e) => [e.filePath, { ...e }]));
  }

  /** Puts rows returned by a write; a renamed row drops its old path. */
  putEntries(entries: VaultEntry[]): void {
    for (const entry of entries) {
      for (const [path, existing] of this.files) if (existing.docId === entry.docId && path !== entry.filePath) this.files.delete(path);
      this.files.set(entry.filePath, { ...entry });
    }
  }

  deleteDoc(docId: string): void {
    for (const [path, existing] of this.files) if (existing.docId === docId) this.files.delete(path);
  }

  /** Synchronous lookup for the RAG read-side guard. */
  peekByDocId(docId: string): VaultEntry | undefined {
    for (const entry of this.files.values()) if (entry.docId === docId) return entry;
    return undefined;
  }

  /** Hook for subclasses that persist (JSON dev fallback). */
  protected changed(): void {}

  private setDeleting(entries: VaultEntry[]): VaultEntry[] {
    const updated = entries.map((e) => ({ ...e, status: VaultEntryStatus.DELETING, updatedAt: this.now().toISOString() }));
    for (const e of updated) this.files.set(e.filePath, e);
    if (updated.length > 0) this.changed();
    return updated.map((e) => ({ ...e }));
  }

  private updateWhere(match: (e: VaultEntry) => boolean, change: (e: VaultEntry) => VaultEntry): VaultEntry | null {
    const entry = this.all().find(match);
    if (!entry) return null;
    const updated = { ...change(entry), updatedAt: this.now().toISOString() };
    this.files.set(updated.filePath, updated);
    this.changed();
    return { ...updated };
  }

  private all(): VaultEntry[] {
    return [...this.files.values()].map((e) => ({ ...e, chunkIds: [...e.chunkIds] })).sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  private visible(): VaultEntry[] {
    return this.all().filter((e) => e.status !== VaultEntryStatus.DELETING);
  }

  private copy(entry: VaultEntry | undefined): VaultEntry | null {
    return entry ? { ...entry, chunkIds: [...entry.chunkIds] } : null;
  }
}
