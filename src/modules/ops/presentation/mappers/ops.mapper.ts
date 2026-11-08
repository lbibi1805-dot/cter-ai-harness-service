import { ValidationError } from '../../../../shared/errors';
import { DEFAULT_LATENCY_WINDOW, DEFAULT_LOG_LIMIT, LATENCY_WINDOW_MS, MAX_LOG_LIMIT, SWAGGER_UI_VERSION } from '../../domain/constants/ops.constants';
import { LatencyWindow } from '../../domain/enums/ops.enums';
import { QueryParams } from '../../../../shared/http/interfaces/router.interface';
import { HeartbeatSettings } from '../../application/interfaces/heartbeatCron.interface';

export function toLogLimit(query: QueryParams): number {
  return Math.min(Number.parseInt(query.limit ?? '', 10) || DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT);
}

/** `?window=1h|24h` (default 1h) to milliseconds. */
export function toLatencyWindowMs(query: QueryParams): { window: LatencyWindow; windowMs: number } {
  const window = (query.window ?? DEFAULT_LATENCY_WINDOW) as LatencyWindow;
  if (!Object.values(LatencyWindow).includes(window)) {
    throw new ValidationError(`window must be one of ${Object.values(LatencyWindow).join(', ')}`);
  }
  return { window, windowMs: LATENCY_WINDOW_MS[window] };
}

/** `POST /api/cron` body: any subset of `{ enabled: boolean, intervalMs: positive number }`. */
export function toCronChanges(body: unknown): Partial<HeartbeatSettings> {
  const raw = (body ?? {}) as { enabled?: unknown; intervalMs?: unknown };
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') throw new ValidationError('enabled must be a boolean');
  if (raw.intervalMs !== undefined && (typeof raw.intervalMs !== 'number' || raw.intervalMs <= 0)) {
    throw new ValidationError('intervalMs must be a positive number');
  }
  return {
    ...(typeof raw.enabled === 'boolean' ? { enabled: raw.enabled } : {}),
    ...(typeof raw.intervalMs === 'number' ? { intervalMs: raw.intervalMs } : {}),
  };
}

export function swaggerHtml(): string {
  const cdn = `https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Vault API Docs</title><link rel="stylesheet" href="${cdn}/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="${cdn}/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset]});</script></body></html>`;
}
