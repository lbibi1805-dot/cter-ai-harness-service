export const AUTO_INDEX_DEBOUNCE_MS = 2000;

/** Backoff for files whose indexing failed (embedding quota, Pinecone down). Kept short: the DB is still awake. */
export const INDEX_RETRY_DELAYS_MS: readonly number[] = [30_000, 90_000, 240_000];
