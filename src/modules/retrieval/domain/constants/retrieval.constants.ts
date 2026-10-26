import { EmbeddingProvider } from '../enums/retrieval.enums';

export const MS_PER_SECOND = 1000;

export const CONTEXT_LENGTH_PATTERN = /maximum context length|too long|8192|2048/i;

export const DEFAULT_TOP_K = 6;

export const DEFAULT_PINECONE_INDEX = 'canvashelper-kb';

export const DEFAULT_VAULT_PATH = './documents-vault';

// ── Chunking ─────────────────────────────────────────────────────
export const CHUNK_MAX_TOKENS = 800;

export const CHUNK_OVERLAP_TOKENS = 100;

/** Rough token estimate used for chunk sizing (no tokenizer dependency). */
export const CHARS_PER_TOKEN = 4;

export const CHUNK_INDEX_DIGITS = 3;

export const CHUNK_ID_HEADING_MAX_CHARS = 30;

// ── Query embedding ──────────────────────────────────────────────
/**
 * Embedding inputs are capped (OpenAI 8192 tokens, Gemini ~2048). A whole
 * exam file is cut to ~1000 tokens, which is enough to find the topic.
 */
export const QUERY_MAX_CHARS = 4000;

/** Second try after a "context length" rejection. */
export const QUERY_FALLBACK_MAX_CHARS = 2000;

// ── Embedding models ─────────────────────────────────────────────
export const EMBEDDING_MODEL: Readonly<Record<EmbeddingProvider, string>> = {
  [EmbeddingProvider.GEMINI]: 'gemini-embedding-001',
  [EmbeddingProvider.OPENAI]: 'text-embedding-3-small',
};

export const EMBEDDING_DIMENSION: Readonly<Record<EmbeddingProvider, number>> = {
  [EmbeddingProvider.GEMINI]: 3072,
  [EmbeddingProvider.OPENAI]: 1536,
};

/** Gemini's free tier allows one request at a time with a pause; OpenAI takes large batches. */
export const DEFAULT_EMBEDDING_DELAY_MS: Readonly<Record<EmbeddingProvider, number>> = {
  [EmbeddingProvider.GEMINI]: 4000,
  [EmbeddingProvider.OPENAI]: 500,
};

export const DEFAULT_EMBEDDING_BATCH_SIZE: Readonly<Record<EmbeddingProvider, number>> = {
  [EmbeddingProvider.GEMINI]: 1,
  [EmbeddingProvider.OPENAI]: 100,
};

export const EMBEDDING_MAX_ATTEMPTS = 5;

export const EMBEDDING_BACKOFF = { baseDelayMs: 3000, maxDelayMs: 30_000, factor: 2 } as const;

// ── Pinecone ─────────────────────────────────────────────────────
export const PINECONE_BATCH_SIZE = 100;

export const PINECONE_METRIC = 'cosine';

export const PINECONE_CLOUD = 'aws';

export const PINECONE_REGION = 'us-east-1';

export const INDEX_READY_POLL_INTERVAL_MS = 2000;

export const INDEX_READY_MAX_POLLS = 30;
