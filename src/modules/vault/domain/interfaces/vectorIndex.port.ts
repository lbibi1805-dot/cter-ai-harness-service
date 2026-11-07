export interface VectorChunkMetadata {
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  docId?: string;
  contentHash?: string;
}

/** Vector index holding the embedded chunks of vault files (Pinecone in prod). */
export interface VectorIndex {
  deleteByIds(ids: string[]): Promise<void>;
  deleteAll(): Promise<void>;
  fetchMetadata(ids: string[]): Promise<Record<string, VectorChunkMetadata>>;
  /** Every vector id starting with `prefix` (all ids when omitted). Throws when the index cannot list (pod indexes). */
  listIds(prefix?: string): Promise<string[]>;
}
