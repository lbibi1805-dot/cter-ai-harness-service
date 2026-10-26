/** A markdown document stored in the vault, with its indexing state. */
export interface VaultEntry {
  filePath: string;
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt: string;
  content: string;
  folderPath?: string;
  depth?: number;
}

export type NewVaultEntry = Pick<VaultEntry, 'filePath' | 'hash' | 'chunkIds' | 'indexed' | 'content'>;

export interface VaultFolder {
  path: string;
  depth: number;
  fileCount: number;
}

export interface VaultFolderGroup {
  folderPath: string;
  fileCount: number;
}

export interface VaultStats {
  total: number;
  indexed: number;
}
