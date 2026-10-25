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
