import type { CanvasAccountConfig } from '../../shared/canvas/interfaces/canvasAccount.interface';
import { Router } from '../../shared/http/router';
import { PollingControlService } from './application/pollingControl.service';
import type { PollCursorRepository, PollJob } from './domain';
import { createPollCursorRepository } from './infrastructure/pollCursorRepository.factory';
import { PollingController } from './presentation/polling.controller';
import { createPollingRoutes } from './presentation/polling.routes';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';
import { usesNeon } from '../../shared/database/helpers/database.helper';
import { PollSchedulerService } from './application/pollScheduler.service';
import { KeyValidator } from './application/interfaces/pollingControl.interface';
import { CachedPollCursorRepository } from './infrastructure/cachedPollCursor.repository';
import { DEFAULT_POLL_CURSOR_FLUSH_MS, SHUTDOWN_FLUSH_TIMEOUT_MS } from './infrastructure/constants/cachedPollCursor.constants';
import type { PollCursorCacheStats } from './infrastructure/interfaces/cachedPollCursor.interface';

export interface PollingModuleConfig {
  intervalMs: number;
  accounts: CanvasAccountConfig[];
  database: DatabaseSettings;
  adminToken?: string;
  /** POLL_CURSOR_FLUSH_MS: Neon cursors are cached in RAM and flushed at most this often. */
  cursorFlushMs?: number;
}

export interface PollingModuleDeps {
  jobs: PollJob[];
  validateKeys: KeyValidator;
  beforeTick?: () => void;
  cursors?: PollCursorRepository;
}

export interface PollingModule {
  scheduler: PollSchedulerService;
  router: Router;
  /** Null when cursors are not cached (local file store, or injected by a test). */
  cursorCache: CachedPollCursorRepository | null;
  /** Graceful stop (SIGTERM): stops ticking, then flushes cached cursors (bounded by SHUTDOWN_FLUSH_TIMEOUT_MS). */
  shutdown(): Promise<void>;
}

export function createPollingModule(config: PollingModuleConfig, deps: PollingModuleDeps): PollingModule {
  // Neon bills awake time: cache its cursors in RAM (the local file store costs nothing per read).
  const cursorCache = !deps.cursors && usesNeon(config.database)
    ? new CachedPollCursorRepository(createPollCursorRepository(config.database), { flushIntervalMs: config.cursorFlushMs ?? DEFAULT_POLL_CURSOR_FLUSH_MS })
    : null;
  const scheduler = new PollSchedulerService({
    intervalMs: config.intervalMs,
    accounts: config.accounts,
    jobs: deps.jobs,
    cursors: cursorCache ?? deps.cursors ?? createPollCursorRepository(config.database),
    beforeTick: deps.beforeTick,
  });
  const router = new Router(createPollingRoutes(new PollingController(new PollingControlService(scheduler, deps.validateKeys))), config.adminToken);
  // Does not wait for the tick in flight (it may be a long AI call): at most that tick's cursor is re-listed after restart.
  const shutdown = async (): Promise<void> => {
    scheduler.stop();
    if (!cursorCache) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => { timer = setTimeout(resolve, SHUTDOWN_FLUSH_TIMEOUT_MS); });
    await Promise.race([cursorCache.flush(), timeout]);
    clearTimeout(timer);
  };
  return { scheduler, router, cursorCache, shutdown };
}

export * from './domain';
export { FilePollCursorRepository } from './infrastructure/filePollCursor.repository';
export { NeonPollCursorRepository } from './infrastructure/neonPollCursor.repository';
export { CachedPollCursorRepository } from './infrastructure/cachedPollCursor.repository';
export { DEFAULT_POLL_CURSOR_FLUSH_MS, SHUTDOWN_SIGNALS } from './infrastructure/constants/cachedPollCursor.constants';
export type { PollCursorCacheStats };
export { PollSchedulerService } from './application/pollScheduler.service';
export type { TickReport } from './application/interfaces/pollScheduler.interface';
export type { SchedulerStatus } from './application/interfaces/pollScheduler.interface';
