export interface StoredEntry {
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt?: string;
  content?: string;
}

export interface ManifestFile {
  files?: Record<string, StoredEntry>;
}
