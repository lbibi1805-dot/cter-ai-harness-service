import { LatencyWindow, OpsApiPath } from '../../domain/enums/ops.enums';

const ADMIN = [{ bearerAuth: [] }];
const OPS_TAG = ['Ops'];
const UNAUTHORIZED = { description: 'Missing or wrong ADMIN_TOKEN' };

function json(description: string) {
  return { description, content: { 'application/json': { schema: { type: 'object' } } } };
}

/**
 * Ops paths merged into the served spec when `docs/openapi.json` does not
 * describe them yet (the file stays the source of truth once it does).
 */
export const OPS_OPENAPI_PATHS: Readonly<Record<string, Record<string, unknown>>> = {
  [OpsApiPath.PING]: {
    get: {
      tags: OPS_TAG,
      summary: 'Liveness: 200 "ok"; touches no database, object storage or vector index (heartbeat + Render health check)',
      responses: { 200: { description: 'ok', content: { 'text/plain': { schema: { type: 'string', example: 'ok' } } } } },
    },
  },
  [OpsApiPath.HEALTH_DEEP]: {
    get: {
      tags: OPS_TAG,
      summary: 'Deep check (costs money): Neon select 1, R2 HEAD, Pinecone describeIndexStats, each timed',
      security: ADMIN,
      responses: { 200: json('{ ok, checkedAt, checks: { database, objectStorage, vectorIndex } }'), 401: UNAUTHORIZED, 503: json('At least one dependency failed') },
    },
  },
  [OpsApiPath.METRICS_DB]: {
    get: {
      tags: OPS_TAG,
      summary: 'Database traffic since boot from RAM counters (0 queries): count, last query time and tag, cursor flushes',
      security: ADMIN,
      responses: { 200: json('{ queriesSinceBoot, lastQueryAt, lastQueryTag, byTag, cursors }'), 401: UNAUTHORIZED },
    },
  },
  [OpsApiPath.METRICS_LATENCY]: {
    get: {
      tags: OPS_TAG,
      summary: 'Latency percentiles per provider/model from the RAM ring buffer',
      security: ADMIN,
      parameters: [{ name: 'window', in: 'query', schema: { type: 'string', enum: Object.values(LatencyWindow), default: LatencyWindow.ONE_HOUR } }],
      responses: { 200: json('Latency summary'), 400: json('Bad window'), 401: UNAUTHORIZED, 503: json('Latency metrics not wired') },
    },
  },
  [OpsApiPath.PROMPTS]: {
    get: { tags: OPS_TAG, summary: 'Prompt registry: id, kind, version, hash, active (note 06)', security: ADMIN, responses: { 200: json('{ promptVersion, prompts }'), 401: UNAUTHORIZED, 404: json('No registry') } },
  },
  [OpsApiPath.EVALS]: {
    get: { tags: OPS_TAG, summary: 'Golden-eval runs on disk vs baseline', security: ADMIN, responses: { 200: json('{ evals: [{ file, date, promptVersion, score, passRate, baseline, delta }] }'), 401: UNAUTHORIZED } },
  },
  [OpsApiPath.CONFIG]: {
    get: {
      tags: OPS_TAG,
      summary: 'Non-secret flags and limits the service runs with (never keys, tokens or URLs with credentials)',
      security: ADMIN,
      responses: { 200: json('Flat map of setting name to value'), 401: UNAUTHORIZED },
    },
  },
  [OpsApiPath.STORAGE_STATS]: {
    get: {
      tags: OPS_TAG,
      summary: 'Object count and bytes per prefix (vault/, conversations/, derived/). Lists the bucket: on demand only',
      security: ADMIN,
      responses: { 200: json('{ kind, location, prefixes, totalObjects, totalBytes, latencyMs }'), 401: UNAUTHORIZED, 503: json('No object storage') },
    },
  },
};
