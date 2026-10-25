import type { ChunkMetadata, CitedChunk, IndexedChunk } from './retrieval.interface';

export interface VectorStore {
  /** Creates the index (or recreates it when the dimension changed) and waits until it is ready. */
  ensureIndex(dimension: number): Promise<void>;
  upsertChunks(chunks: IndexedChunk[]): Promise<void>;
  query(vector: number[], topK: number): Promise<CitedChunk[]>;
  /** A missing index counts as already empty. */
  deleteAll(): Promise<void>;
  /** A missing index counts as already deleted. */
  deleteByIds(ids: string[]): Promise<void>;
  fetchByIds(ids: string[]): Promise<Record<string, ChunkMetadata & { id: string }>>;
}
