export interface VaultEntry {
  filePath: string;
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  folderPath?: string;
  depth?: number;
}

export interface VaultStorage {
  init(): Promise<void>;
  list(opts?: { folder?: string; q?: string; indexed?: boolean; limit?: number; offset?: number }): Promise<{ entries: VaultEntry[]; total: number }>;
  get(filePath: string): Promise<VaultEntry | null>;
  upsert(entry: Omit<VaultEntry, 'updatedAt' | 'folderPath' | 'depth'>): Promise<void>;
  remove(filePath: string): Promise<void>;
  listFolders(): Promise<{ path: string; depth: number; fileCount: number }[]>;
  stats(): Promise<{ total: number; indexed: number }>;
}
