import { IndexedVersion, VaultFolder, VaultEntry, VaultStats, VaultVersion } from './vaultEntry.interface';

export interface VaultSearchCriteria {
  folder?: string;
  text?: string;
  indexed?: boolean;
  limit: number;
  offset: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

/**
 * Persistence port for the vault manifest. Writes return the rows they
 * changed (RETURNING *) so a cache can stay coherent without re-reading.
 * Rows in `deleting` state are hidden from every read except `findDeleting`.
 */
export interface VaultRepository {
  search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>>;
  findAll(): Promise<VaultEntry[]>;
  findByFolder(folder: string): Promise<VaultEntry[]>;
  /** Includes a `deleting` row (an upload on top of it must finish the delete first). */
  findByPath(filePath: string): Promise<VaultEntry | null>;
  findDeleting(): Promise<VaultEntry[]>;
  listFolders(): Promise<VaultFolder[]>;
  stats(): Promise<VaultStats>;

  /** Points the row at a new content version (insert or update), status `indexing`. */
  saveVersion(version: VaultVersion): Promise<VaultEntry>;
  /** Makes an embedded version live; null when the row moved on to another hash (or is being deleted) meanwhile. */
  commitIndexed(version: IndexedVersion): Promise<VaultEntry | null>;
  markFailed(docId: string, hash: string, error: string): Promise<VaultEntry | null>;
  rename(filePath: string, newPath: string): Promise<VaultEntry | null>;
  /** Commits `deleting` first; returns the rows to clean up. */
  markDeleting(filePath: string): Promise<VaultEntry | null>;
  markFolderDeleting(folder: string): Promise<VaultEntry[]>;
  markAllDeleting(): Promise<VaultEntry[]>;
  /** Last step of a delete: only removes a row still in `deleting`. */
  removeDeleted(docId: string): Promise<boolean>;
  /** Removes every row in `deleting` (end of "clear all"); returns how many. */
  removeAllDeleted(): Promise<number>;
}
