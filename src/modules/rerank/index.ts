import { logger } from '../../utils/logger';
import { RerankingRetriever } from './application/rerankingRetriever.service';
import { RerankProvider, type ChunkRetriever, type RerankConfig, type Reranker } from './domain';
import { PineconeReranker } from './infrastructure/pineconeReranker';

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

/** Reranking is off unless RERANK_PROVIDER=pinecone and a Pinecone key is configured. */
export function createRerankModule(config: RerankConfig, deps: RerankModuleDeps): RerankModule {
  const reranker = deps.reranker ?? buildReranker(config, deps);
  if (reranker) logger.info(`[rerank] enabled — ${reranker.model}, ${config.candidates} candidates → top ${config.topN}`);

  return {
    enabled: reranker !== null,
    config,
    candidateCount: (defaultTopK) => (reranker ? Math.max(config.candidates, defaultTopK) : defaultTopK),
    wrap: (inner, options) => (reranker
      ? new RerankingRetriever(inner, reranker, {
        ...options,
        timeoutMs: config.timeoutMs,
        maxQueryChars: config.maxQueryChars,
        maxDocumentChars: config.maxDocumentChars,
      })
      : inner),
  };
}

function buildReranker(config: RerankConfig, deps: RerankModuleDeps): Reranker | null {
  if (config.provider !== RerankProvider.PINECONE || !deps.pineconeApiKey) return null;
  return new PineconeReranker({ apiKey: deps.pineconeApiKey, model: config.model, controllerHostUrl: deps.controllerHostUrl });
}

export { RerankingRetriever, applyHits, buildRerankRequest, fuseWithVectorOrder, RRF_K } from './application/rerankingRetriever.service';
export { PineconeReranker } from './infrastructure/pineconeReranker';
export * from './domain';
