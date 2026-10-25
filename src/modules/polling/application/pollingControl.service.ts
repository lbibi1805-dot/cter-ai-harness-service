import { StartOutcome, StopOutcome } from '../domain';
import type { PollSchedulerService } from './pollScheduler.service';
import { SchedulerStatus } from './interfaces/pollScheduler.interface';
import { KeyValidator, StartResult } from './interfaces/pollingControl.interface';

/** Operator control of polling: start (after checking AI credentials), stop, status. */
export class PollingControlService {
  constructor(
    private readonly scheduler: PollSchedulerService,
    private readonly validateKeys: KeyValidator,
  ) {}

  async start(): Promise<StartResult> {
    if (this.scheduler.isRunning()) return { status: StartOutcome.ALREADY_RUNNING };
    const validation = await this.validateKeys();
    return { status: this.scheduler.start(), validation };
  }

  stop(): StopOutcome {
    return this.scheduler.stop();
  }

  status(): SchedulerStatus {
    return this.scheduler.status();
  }
}
