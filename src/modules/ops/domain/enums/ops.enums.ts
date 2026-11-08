export enum ServiceState {
  UP = 'up',
}

export enum OpsApiPath {
  ROOT = '/',
  /** Liveness only (heartbeat + Render health check): depends on nothing. */
  PING = '/ping',
  HEALTH = '/health',
  /** Admin: real round-trips to Neon, R2 and Pinecone (costs money; on demand only). */
  HEALTH_DEEP = '/health/deep',
  OPENAPI = '/openapi.json',
  DOCS = '/docs',
  DOCS_SLASH = '/docs/',
  LOGS = '/api/logs',
  AI_USAGE = '/api/ai-usage',
  CANVAS_ACCOUNTS = '/api/canvas-accounts',
  CRON = '/api/cron',
  STORAGE_CHECK = '/api/storage/check',
  /** Admin: object count + bytes per prefix (R2 list: Class A operations, on demand only). */
  STORAGE_STATS = '/api/storage/stats',
  /** Admin: RAM counters of database traffic (proves Neon can sleep). */
  METRICS_DB = '/api/metrics/db',
  /** Admin: latency percentiles from the RAM ring buffer. */
  METRICS_LATENCY = '/api/metrics/latency',
  /** Admin: non-secret flags and limits the service runs with. */
  CONFIG = '/api/config',
  /** Admin: prompt registry files, versions and hashes (note 06). */
  PROMPTS = '/api/prompts',
  /** Admin: golden-eval results on disk vs baseline (notes 06, 15). */
  EVALS = '/api/evals',
}

/** Dependencies probed by `GET /health/deep`. Values are part of the public API. */
export enum DeepCheckName {
  DATABASE = 'database',
  OBJECT_STORAGE = 'objectStorage',
  VECTOR_INDEX = 'vectorIndex',
}

/** Outcome of one deep check. Values are part of the public API. */
export enum DeepCheckStatus {
  OK = 'ok',
  FAILED = 'failed',
  /** The dependency is not configured in this environment. */
  SKIPPED = 'skipped',
}

/** `?window=` of `GET /api/metrics/latency`. */
export enum LatencyWindow {
  ONE_HOUR = '1h',
  ONE_DAY = '24h',
}
