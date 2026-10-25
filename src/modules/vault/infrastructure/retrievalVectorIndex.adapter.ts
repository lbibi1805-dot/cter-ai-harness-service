import type { VectorStore } from '../../retrieval';
import type { VectorChunkMetadata, VectorIndex } from '../domain';

/** Adapts the retrieval module's vector store to the vault's `VectorIndex` port. */
export class RetrievalVectorIndex implements VectorIndex {
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
