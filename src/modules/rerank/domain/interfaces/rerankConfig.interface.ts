import { RerankProvider } from '../enums/rerank.enums';

export interface RerankConfig {
  provider: RerankProvider;
  model: string;
  /** Vector-search candidates fetched before reranking (replaces RAG_TOP_K as the Pinecone top-k). */
  candidates: number;
  /** Chunks kept for the single-shot prompt after reranking. */
  topN: number;
  /** Past this the reranker is skipped and the cosine order is used. */
  timeoutMs: number;
  /** Long inputs (a whole exam file) are cut so query + document fit the model window. */
  maxQueryChars: number;
  maxDocumentChars: number;
}
