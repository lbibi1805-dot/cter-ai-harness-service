import type { CandidateReranker, ChunkSource } from '../../domain/interfaces/candidateReranker.port';

export interface RetrieveRequest {
  query: string;
  /** Chunks wanted; omitted = the production single-shot setting. */
  topK?: number;
  /** Rerank the candidates (only when reranking is configured); omitted = production setting. */
  rerank?: boolean;
}

export interface RetrievalQueryDeps {
  /** False when CHAT_API_TOKEN is unset: the API fails closed (it reveals vault content). */
  enabled: boolean;
  /** Null when Pinecone is not configured. */
  vectorSearch: { defaultTopK: number; createRetriever(topK: number): ChunkSource } | null;
  reranker: CandidateReranker;
  /** The retriever single-shot prompts use, once the vault is indexed. */
  productionRetriever: () => ChunkSource | null;
}
