export const DEFAULT_API_PORT = 3000;
export const DEFAULT_POLL_INTERVAL_MS = 60_000;

/** Project files read at startup (relative to the working directory). */
export const SYSTEM_PROMPT_FILE = 'system-prompt.md';
export const KNOWLEDGE_FILE = 'knowledge.md';
export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.';

/** A record stuck in PROCESSING longer than every retry could take (timeout × (retries + margin)) is abandoned. */
export const STALE_RETRY_MARGIN = 2;

/** Base for parsing the request path (only the path and query are used). */
export const URL_BASE = 'http://localhost';
