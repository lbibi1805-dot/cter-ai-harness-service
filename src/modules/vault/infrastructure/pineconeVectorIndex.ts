import type { VectorStore } from '../../../rag/vectorStore';
import type { VectorChunkMetadata, VectorIndex } from '../domain';

/** Adapts the RAG Pinecone store to the vault's `VectorIndex` port. */
export class PineconeVectorIndex implements VectorIndex {
  constructor(private readonly store: VectorStore) {}

  deleteByIds(ids: string[]): Promise<void> {
    return this.store.deleteByIds(ids);
  }

  deleteAll(): Promise<void> {
    return this.store.deleteAll();
  }

  fetchMetadata(ids: string[]): Promise<Record<string, VectorChunkMetadata>> {
    return this.store.fetchByIds(ids);
  }
}
