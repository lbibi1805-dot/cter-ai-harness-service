import { Router } from '../../shared/http/router';
import type { AppConfig } from '../../types';
import { PollSchedulerService } from './application/pollScheduler.service';
import type { PollCursorRepository, PollJob } from './domain';
import { createPollCursorRepository } from './infrastructure/pollCursorRepository.factory';
import { PollingController, type KeyValidator } from './presentation/polling.controller';
import { createPollingRoutes } from './presentation/polling.routes';

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

export function createPollingModule(config: AppConfig, deps: PollingModuleDeps): PollingModule {
  const scheduler = new PollSchedulerService({
    intervalMs: config.pollIntervalMs,
    accounts: config.accounts,
    jobs: deps.jobs,
    cursors: deps.cursors ?? createPollCursorRepository(config.database),
    beforeTick: deps.beforeTick,
  });
  const router = new Router(createPollingRoutes(new PollingController(scheduler, deps.validateKeys)), config.adminToken);
  return { scheduler, router };
}

export { PollSchedulerService, type SchedulerStatus, type TickReport } from './application/pollScheduler.service';
export { FilePollCursorRepository } from './infrastructure/filePollCursor.repository';
export * from './domain';
