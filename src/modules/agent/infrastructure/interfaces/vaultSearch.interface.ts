import type { CitedChunk } from '../../../retrieval/domain/interfaces/retrieval.interface';

/** Port over the retriever so the tool can be tested without Pinecone. */
export interface VaultSearcher {
  search(query: string): Promise<CitedChunk[]>;
}
