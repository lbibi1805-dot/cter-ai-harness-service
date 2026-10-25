/** Who reorders vector-search candidates. `none` keeps the cosine order (legacy behaviour). */
export enum RerankProvider {
  NONE = 'none',
  PINECONE = 'pinecone',
}

/** Pinecone-hosted reranking models known to work here. */
export enum RerankModel {
  /** Multilingual cross-encoder (the vault is mostly Vietnamese). */
  BGE_RERANKER_V2_M3 = 'bge-reranker-v2-m3',
  COHERE_RERANK_3_5 = 'cohere-rerank-3.5',
  PINECONE_RERANK_V0 = 'pinecone-rerank-v0',
}
