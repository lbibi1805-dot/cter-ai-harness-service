import type { CanvasAccountConfig } from '../../shared/canvas/interfaces/canvasAccount.interface';
import { Router } from '../../shared/http/router';
import { PollingControlService } from './application/pollingControl.service';
import type { PollCursorRepository, PollJob } from './domain';
import { createPollCursorRepository } from './infrastructure/pollCursorRepository.factory';
import { PollingController } from './presentation/polling.controller';
import { createPollingRoutes } from './presentation/polling.routes';
import { DatabaseSettings } from '../../shared/database/interfaces/database.interface';
import { PollSchedulerService } from './application/pollScheduler.service';
import { KeyValidator } from './application/interfaces/pollingControl.interface';

export interface PollingModuleConfig {
  intervalMs: number;
  accounts: CanvasAccountConfig[];
  database: DatabaseSettings;
  adminToken?: string;
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
}

export function createPollingModule(config: PollingModuleConfig, deps: PollingModuleDeps): PollingModule {
  const scheduler = new PollSchedulerService({
    intervalMs: config.intervalMs,
    accounts: config.accounts,
    jobs: deps.jobs,
    cursors: deps.cursors ?? createPollCursorRepository(config.database),
    beforeTick: deps.beforeTick,
  });
  const router = new Router(createPollingRoutes(new PollingController(new PollingControlService(scheduler, deps.validateKeys))), config.adminToken);
  return { scheduler, router };
}

export * from './domain';
export { FilePollCursorRepository } from './infrastructure/filePollCursor.repository';
export { PollSchedulerService } from './application/pollScheduler.service';
export type { TickReport } from './application/interfaces/pollScheduler.interface';
export type { SchedulerStatus } from './application/interfaces/pollScheduler.interface';
