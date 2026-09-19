import type { IndexedChunk } from '../../rag/vectorStore';

export interface IVectorStore {
  ensureIndex(dimension: number): Promise<void>;
  upsertChunks(chunks: IndexedChunk[]): Promise<void>;
  query(vector: number[], topK: number): Promise<import('../../types').CitedChunk[]>;
  deleteByIds(ids: string[]): Promise<void>;
}
