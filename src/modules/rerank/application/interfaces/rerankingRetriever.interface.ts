export interface RerankingOptions {
  /** Chunks returned after reranking. */
  topN: number;
  /** Chunks returned (in cosine order) when the reranker fails or times out. */
  fallbackTopK: number;
  timeoutMs: number;
  maxQueryChars: number;
  maxDocumentChars: number;
  /** Shown in logs: which path asked (single-shot / agent). */
  label: string;
}
