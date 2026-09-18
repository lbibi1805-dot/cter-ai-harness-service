/**
 * `modules/vault` DTOs — data crossing the vault module boundary. Moved from
 * `src/vault/VaultStorage.ts` (Phase 1, mục 3.1 / mục 6 Phase 1 step 2).
 */
export interface VaultEntry {
  filePath: string;
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  folderPath?: string;
  depth?: number;
}

export interface VaultListOptions {
  folder?: string;
  q?: string;
  indexed?: boolean;
  limit?: number;
  offset?: number;
}

export interface VaultListResult {
  entries: VaultEntry[];
  total: number;
}

export interface VaultFolderSummary {
  path: string;
  depth: number;
  fileCount: number;
}

export interface VaultStats {
  total: number;
  indexed: number;
}
