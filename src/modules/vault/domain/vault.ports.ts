export interface VectorChunkMetadata {
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
}

/** Vector index holding the embedded chunks of vault files (Pinecone in prod). */
export interface VectorIndex {
  deleteByIds(ids: string[]): Promise<void>;
  deleteAll(): Promise<void>;
  fetchMetadata(ids: string[]): Promise<Record<string, VectorChunkMetadata>>;
}

/** Raw markdown copies of vault files (local disk). Best-effort, never authoritative. */
export interface VaultDocumentStore {
  write(filePath: string, content: string): Promise<void>;
  remove(filePaths: string[]): Promise<void>;
}

/** Chunks + embeds every pending vault entry. */
export interface VaultIndexer {
  indexAll(): Promise<void>;
}

export type VaultIndexerFactory = () => VaultIndexer;
