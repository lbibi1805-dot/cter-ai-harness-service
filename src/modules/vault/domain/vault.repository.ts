import type { NewVaultEntry, VaultEntry, VaultFolder, VaultStats } from './vaultEntry';

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

/** Persistence port for vault manifest entries. All queries live behind this. */
export interface VaultRepository {
  search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>>;
  findAll(): Promise<VaultEntry[]>;
  findByFolder(folder: string): Promise<VaultEntry[]>;
  findByPath(filePath: string): Promise<VaultEntry | null>;
  save(entry: NewVaultEntry): Promise<void>;
  remove(filePath: string): Promise<void>;
  removeAll(): Promise<void>;
  listFolders(): Promise<VaultFolder[]>;
  stats(): Promise<VaultStats>;
}
