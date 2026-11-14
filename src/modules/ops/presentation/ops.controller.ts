import { readJsonBody } from '../../../shared/http/body';
import { ContentType, HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { HeartbeatCron } from '../application/heartbeatCron.service';
import type { OpsService } from '../application/ops.service';
import { swaggerHtml, toCronChanges, toLatencyWindowMs, toLogLimit } from './mappers/ops.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { CRON_BODY_LIMIT_BYTES, LATENCY_NOT_AVAILABLE, PROMPT_REGISTRY_NOT_AVAILABLE, PLAIN_TEXT_CONTENT_TYPE, PUBLIC_CORS, STORAGE_NOT_CONFIGURED } from './constants/ops.constants';
import { PING_BODY } from '../domain/constants/ops.constants';

/** HTTP adapter for status, health, docs, logs and heartbeat. */
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly cron: HeartbeatCron,
  ) {}

  root = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.overview());
  };

  /** `GET /ping`: liveness only, no database, storage or vector index (heartbeat + Render health check). */
  ping = async ({ res }: RouteContext): Promise<void> => {
    res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: PLAIN_TEXT_CONTENT_TYPE });
    res.end(PING_BODY);
  };

  health = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, await this.ops.health());
  };

  /** `GET /health/deep` (admin): real round-trips to Neon, R2 and Pinecone; 503 when one fails. */
  deepHealth = async ({ res }: RouteContext): Promise<void> => {
    const report = await this.ops.deepHealth();
    sendJson(res, report.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE, report);
  };

  /** `GET /api/metrics/db` (admin): RAM counters only. */
  dbMetrics = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.dbMetrics() ?? {});
  };

  /** `GET /api/prompts` (admin): `{ promptVersion, prompts: [...] }`; 404 without a registry. */
  prompts = async ({ res }: RouteContext): Promise<void> => {
    const prompts = this.ops.prompts();
    if (!prompts) return sendJson(res, HttpStatus.NOT_FOUND, { error: PROMPT_REGISTRY_NOT_AVAILABLE });
    sendJson(res, HttpStatus.OK, prompts);
  };

  /** `GET /api/evals[?kind=rule-compliance|design-compliance|golden-qa]` (admin): eval runs on disk, newest first. */
  evals = async ({ res, query }: RouteContext): Promise<void> => {
    const kind = query.kind?.trim() || undefined;
    sendJson(res, HttpStatus.OK, { evals: this.ops.evals(kind) });
  };

  /** `GET /api/metrics/latency?window=1h|24h` (admin): 503 until a latency provider is wired. */
  latency = async ({ res, query }: RouteContext): Promise<void> => {
    const { window, windowMs } = toLatencyWindowMs(query);
    if (!this.ops.hasLatency()) return sendJson(res, HttpStatus.SERVICE_UNAVAILABLE, { error: LATENCY_NOT_AVAILABLE, window });
    sendJson(res, HttpStatus.OK, { window, windowMs, metrics: this.ops.latency(windowMs) ?? null });
  };

  /** `GET /api/config` (admin): non-secret flags and limits. */
  config = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.publicConfig());
  };

  /** `GET /api/storage/stats` (admin): lists the bucket, on demand only. */
  storageStats = async ({ res }: RouteContext): Promise<void> => {
    const stats = await this.ops.storageStats();
    if (!stats) return sendJson(res, HttpStatus.SERVICE_UNAVAILABLE, { error: STORAGE_NOT_CONFIGURED });
    sendJson(res, HttpStatus.OK, stats);
  };

  openApiSpec = async ({ res }: RouteContext): Promise<void> => {
    const spec = this.ops.openApiSpec();
    res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: ContentType.JSON, ...PUBLIC_CORS });
    res.end(spec);
  };

  docs = async ({ res }: RouteContext): Promise<void> => {
    res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: ContentType.HTML });
    res.end(swaggerHtml());
  };

  logs = async ({ res, query }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { logs: this.ops.recentLogs(toLogLimit(query)) });
  };

  clearLogs = async ({ res }: RouteContext): Promise<void> => {
    this.ops.clearLogs();
    sendJson(res, HttpStatus.OK, { ok: true });
  };

  aiUsage = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.aiUsage());
  };

  canvasAccounts = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { accounts: this.ops.canvasAccounts() });
  };

  /** `GET /api/storage/check` (admin): writes, reads and deletes one tiny object; 503 when it fails. */
  storageCheck = async ({ res }: RouteContext): Promise<void> => {
    const probe = await this.ops.storageCheck();
    if (!probe) return sendJson(res, HttpStatus.SERVICE_UNAVAILABLE, { ok: false, error: STORAGE_NOT_CONFIGURED });
    sendJson(res, probe.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE, probe);
  };

  cronStatus = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.cron.status());
  };

  updateCron = async ({ req, res }: RouteContext): Promise<void> => {
    const changes = toCronChanges(await readJsonBody(req, CRON_BODY_LIMIT_BYTES));
    sendJson(res, HttpStatus.OK, this.cron.update(changes));
  };
}
