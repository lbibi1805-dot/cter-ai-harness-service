import { RerankModel, RerankProvider } from './rerank.enums';

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

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  provider: RerankProvider.NONE,
  model: RerankModel.BGE_RERANKER_V2_M3,
  candidates: 40,
  topN: 8,
  timeoutMs: 5_000,
  maxQueryChars: 600,
  maxDocumentChars: 1_500,
};

/** Unknown values disable reranking rather than failing startup. */
export function parseRerankProvider(value: string | undefined): RerankProvider {
  return value === RerankProvider.PINECONE ? RerankProvider.PINECONE : RerankProvider.NONE;
}
