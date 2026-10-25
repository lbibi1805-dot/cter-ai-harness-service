import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { PollingControlService } from '../application/pollingControl.service';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';

/** Polling control endpoints. Response shapes match the previous `/start` and `/stop`. */
export class PollingController {
  constructor(private readonly polling: PollingControlService) {}

  start = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, await this.polling.start());
  };

  stop = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { status: this.polling.stop() });
  };

  status = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.polling.status());
  };
}
