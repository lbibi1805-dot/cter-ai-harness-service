import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { HEARTBEAT_PATH } from '../domain/constants/ops.constants';
import { HeartbeatSettings } from './interfaces/heartbeatCron.interface';

/** Self-ping that keeps a sleeping host (Render free tier) awake; adjustable at runtime via `/api/cron`. */
export class HeartbeatCron {
  private timer: ReturnType<typeof setInterval> | null = null;
  private settings: HeartbeatSettings;

  constructor(initial: HeartbeatSettings, private readonly port: number) {
    this.settings = { ...initial };
  }

  status(): HeartbeatSettings {
    return { ...this.settings };
  }

  start(): void {
    this.stop();
    if (!this.settings.enabled) return;
    this.timer = setInterval(() => void this.ping(), this.settings.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  update(changes: Partial<HeartbeatSettings>): HeartbeatSettings {
    this.settings = { ...this.settings, ...changes };
    if (this.settings.enabled) this.start();
    else this.stop();
    return this.status();
  }

  private async ping(): Promise<void> {
    const pinged = await attempt(() => fetch(`http://localhost:${this.port}${HEARTBEAT_PATH}`));
    if (pinged.ok) logger.info(`[CRON] heartbeat every ${this.settings.intervalMs}ms`);
    else logger.warn(`[CRON] heartbeat failed: ${errorMessage(pinged.error)}`);
  }
}
