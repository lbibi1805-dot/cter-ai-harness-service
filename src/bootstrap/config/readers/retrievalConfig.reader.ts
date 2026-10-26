import {
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DELAY_MS,
  DEFAULT_PINECONE_INDEX,
  DEFAULT_TOP_K,
  DEFAULT_VAULT_PATH,
  EmbeddingProvider,
  type RetrievalConfig,
} from '../../../modules/retrieval';
import { readEnum, readInt, readOptionalString, readString } from '../../../shared/config/env';

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
    embeddingDelayMs: readInt('EMBEDDING_DELAY_MS', DEFAULT_EMBEDDING_DELAY_MS[embeddingProvider]),
    embeddingBatchSize: readInt('EMBEDDING_BATCH_SIZE', DEFAULT_EMBEDDING_BATCH_SIZE[embeddingProvider]),
  };
}
