import type { CanvasAccountConfig } from '../../../shared/canvas/interfaces/canvasAccount.interface';
import type { Router } from '../../../shared/http/router';
import type { PollCursorRepository, PollJob } from '../domain';
import type { DatabaseSettings } from '../../../shared/database/interfaces/database.interface';
import type { PollSchedulerService } from '../application/pollScheduler.service';
import type { KeyValidator } from '../application/interfaces/pollingControl.interface';
import type { CachedPollCursorRepository } from '../infrastructure/cachedPollCursor.repository';
import type { SHUTDOWN_FLUSH_TIMEOUT_MS } from '../infrastructure/constants/cachedPollCursor.constants';

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
