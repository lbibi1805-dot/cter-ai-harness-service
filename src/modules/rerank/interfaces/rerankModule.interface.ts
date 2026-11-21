import type { ChunkRetriever, RerankConfig, Reranker } from '../domain';

export interface RerankModuleDeps {
  pineconeApiKey?: string;
  /** Test hooks. */
  reranker?: Reranker;
  controllerHostUrl?: string;
}

export interface WrapOptions {
  /** Chunks the caller wants back. */
  topN: number;
  /** Chunks returned in cosine order when reranking fails (the pre-rerank behaviour). */
  fallbackTopK: number;
  label: string;
}

export interface RerankModule {
  enabled: boolean;
  config: RerankConfig;
  /** Pinecone top-k the inner retriever should use: wider when reranking. */
  candidateCount(defaultTopK: number): number;
  /** Returns `inner` unchanged when reranking is off. */
  wrap(inner: ChunkRetriever, options: WrapOptions): ChunkRetriever;
}
