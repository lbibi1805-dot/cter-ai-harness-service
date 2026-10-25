import { DEFAULT_RERANK_CONFIG, parseRerankProvider, type RerankConfig } from '../../../modules/rerank/domain';
import { readInt, readOptionalString, readString } from '../../../shared/config/env';

/** Reranking stays off unless RERANK_PROVIDER=pinecone. */
export function readRerankConfig(): RerankConfig {
  return {
    provider: parseRerankProvider(readOptionalString('RERANK_PROVIDER')),
    model: readString('RERANK_MODEL', DEFAULT_RERANK_CONFIG.model),
    candidates: readInt('RERANK_CANDIDATES', DEFAULT_RERANK_CONFIG.candidates),
    topN: readInt('RERANK_TOP_N', DEFAULT_RERANK_CONFIG.topN),
    timeoutMs: readInt('RERANK_TIMEOUT_MS', DEFAULT_RERANK_CONFIG.timeoutMs),
    maxQueryChars: DEFAULT_RERANK_CONFIG.maxQueryChars,
    maxDocumentChars: DEFAULT_RERANK_CONFIG.maxDocumentChars,
  };
}
