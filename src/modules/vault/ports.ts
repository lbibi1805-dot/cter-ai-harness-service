import type { VaultEntry, VaultFolderSummary, VaultListOptions, VaultListResult, VaultStats } from './dto';

/**
 * `modules/vault` port — the capability every storage backend (sqlite-disk,
 * Postgres, Neon HTTP) implements. Moved from `src/vault/VaultStorage.ts`
 * (Phase 1, mục 3.1 / mục 6 Phase 1 step 2). Behavior unchanged.
 */
export interface VaultStorage {
  init(): Promise<void>;
  list(opts?: VaultListOptions): Promise<VaultListResult>;
  get(filePath: string): Promise<VaultEntry | null>;
  upsert(entry: Omit<VaultEntry, 'updatedAt' | 'folderPath' | 'depth'>): Promise<void>;
  remove(filePath: string): Promise<void>;
  listFolders(): Promise<VaultFolderSummary[]>;
  stats(): Promise<VaultStats>;
}
