import {
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DELAY_MS,
  DEFAULT_HYBRID_SEARCH_ENABLED,
  DEFAULT_PINECONE_INDEX,
  DEFAULT_MIN_SCORE,
  DEFAULT_TOP_K,
  DEFAULT_VAULT_PATH,
  EmbeddingProvider,
  type RetrievalConfig,
} from '../../../modules/retrieval';
import { readBoolean, readEnum, readInt, readOptionalString, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';

/** Null without PINECONE_API_KEY (RAG, agent search and indexing are then off). */
export function readRetrievalConfig(): RetrievalConfig | null {
  const pineconeApiKey = readOptionalString('PINECONE_API_KEY');
  if (!pineconeApiKey) return null;
  const embeddingProvider = readEnum('EMBEDDING_PROVIDER', EmbeddingProvider, EmbeddingProvider.GEMINI);
  return {
    pineconeApiKey,
    pineconeIndex: readString('PINECONE_INDEX', DEFAULT_PINECONE_INDEX),
    embeddingProvider,
    vaultPath: readString('VAULT_PATH', DEFAULT_VAULT_PATH),
    topK: readInt('RAG_TOP_K', DEFAULT_TOP_K),
    minScore: readFloat('RAG_MIN_SCORE', DEFAULT_MIN_SCORE),
    embeddingDelayMs: readInt('EMBEDDING_DELAY_MS', DEFAULT_EMBEDDING_DELAY_MS[embeddingProvider]),
    embeddingBatchSize: readInt('EMBEDDING_BATCH_SIZE', DEFAULT_EMBEDDING_BATCH_SIZE[embeddingProvider]),
    hybridSearch: readBoolean('HYBRID_SEARCH_ENABLED', DEFAULT_HYBRID_SEARCH_ENABLED),
  };
}

/** Decimal env value (RAG_MIN_SCORE); blank = fallback, garbage fails at startup. */
function readFloat(name: string, fallback: number): number {
  const raw = readOptionalString(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ConfigurationError(`${name} must be a number, got "${raw}"`);
  return value;
}
