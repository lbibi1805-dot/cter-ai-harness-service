import type { CitedChunk } from '../../../types';

export interface RerankHit {
  /** Position of the document in the request. */
  index: number;
  /** Relevance in [0, 1]; higher is more relevant. */
  score: number;
}

/** Port implemented per provider (Pinecone Inference in production). */
export interface Reranker {
  readonly model: string;
  /** Returns at most `topN` hits, most relevant first. */
  rerank(query: string, documents: string[], topN: number): Promise<RerankHit[]>;
}

/** What the prompt builder and the agent search need from retrieval. RAGRetriever satisfies it. */
export interface ChunkRetriever {
  retrieve(question: string): Promise<CitedChunk[]>;
}
