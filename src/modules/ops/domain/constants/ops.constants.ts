/** Render free instances sleep after 15 minutes idle; a self-ping every 12 keeps them awake. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 12 * 60 * 1000;
export const HEARTBEAT_PATH = '/health';

export const DEFAULT_LOG_LIMIT = 100;
export const MAX_LOG_LIMIT = 500;
/** Recent log lines scanned when counting AI calls for `/api/ai-usage`. */
export const AI_USAGE_SCAN_LINES = 500;
export const AI_USAGE_RECENT_LINES = 20;
export const AI_USAGE_RECENT_SHOWN = 10;

export const OPENAPI_SPEC_PATH = 'docs/openapi.json';
export const SWAGGER_UI_VERSION = '5';
/** Vault status shown by `/health` when Pinecone is not configured. */
export const NO_VAULT_STATUS = 'no-vault-config';
