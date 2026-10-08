import type { KeyValidationResult } from '../../../ai/aiRouter';
import { HttpStatus } from '../../../shared/http/http.enums';
import { sendError, sendJson } from '../../../shared/http/response';
import type { RouteContext } from '../../../shared/http/router';
import type { PollSchedulerService } from '../application/pollScheduler.service';
import { StartOutcome } from '../domain';

export type KeyValidator = () => Promise<KeyValidationResult[]>;

/** Polling control endpoints. Response shapes match the previous `/start` and `/stop`. */
export class PollingController {
  constructor(
    private readonly scheduler: PollSchedulerService,
    private readonly validateKeys: KeyValidator,
  ) {}

  start = async ({ res }: RouteContext): Promise<void> => {
    if (this.scheduler.isRunning()) return sendJson(res, HttpStatus.OK, { status: StartOutcome.ALREADY_RUNNING });
    try {
      const validation = await this.validateKeys();
      sendJson(res, HttpStatus.OK, { status: this.scheduler.start(), validation });
    } catch (err) {
      sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, (err as Error).message);
    }
  };

  stop = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { status: this.scheduler.stop() });
  };

  status = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.scheduler.status());
  };
}
