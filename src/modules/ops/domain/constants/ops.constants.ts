import { LatencyWindow, OpsApiPath } from '../enums/ops.enums';

/** Render free instances sleep after 15 minutes idle; a self-ping every 12 keeps them awake. */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 12 * 60 * 1000;
/** The heartbeat hits `/ping`, which touches no database, object storage or vector index (Neon must be able to sleep). */
export const HEARTBEAT_PATH: string = OpsApiPath.PING;
export const PING_BODY = 'ok';

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
/** Vault status shown by `/health` until the startup manifest load finished (`/health` never loads it). */
export const VAULT_LOADING_STATUS = 'loading';

export const LATENCY_WINDOW_MS: Readonly<Record<LatencyWindow, number>> = {
  [LatencyWindow.ONE_HOUR]: 60 * 60 * 1000,
  [LatencyWindow.ONE_DAY]: 24 * 60 * 60 * 1000,
};
export const DEFAULT_LATENCY_WINDOW = LatencyWindow.ONE_HOUR;
