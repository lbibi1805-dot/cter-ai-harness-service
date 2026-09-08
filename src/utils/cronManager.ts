import { logger } from './logger';

let timer: ReturnType<typeof setInterval> | null = null;
let enabled = process.env.CRON_ENABLED !== 'false';
let intervalMs = parseInt(process.env.CRON_INTERVAL_MS ?? '720000', 10);

export function isCronEnabled(): boolean { return enabled; }
export function getCronIntervalMs(): number { return intervalMs; }

export function startCron(apiPort: number): void {
  if (timer) clearInterval(timer);
  if (!enabled) return;
  timer = setInterval(() => {
    fetch(`http://localhost:${apiPort}/health`).then(() => logger.info('[CRON] heartbeat 12m')).catch(() => {});
  }, intervalMs);
}

export function stopCron(): void {
  if (timer) { clearInterval(timer); timer = null; }
}

export function setCronEnabled(v: boolean, apiPort: number): void {
  enabled = v;
  if (v) startCron(apiPort);
  else stopCron();
}

export function setCronInterval(ms: number, apiPort: number): void {
  intervalMs = ms;
  if (enabled) { stopCron(); startCron(apiPort); }
}
