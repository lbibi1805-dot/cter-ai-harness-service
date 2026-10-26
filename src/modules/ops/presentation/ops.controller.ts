import { readJsonBody } from '../../../shared/http/body';
import { ContentType, HttpHeader, HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { HeartbeatCron } from '../application/heartbeatCron.service';
import type { OpsService } from '../application/ops.service';
import { swaggerHtml, toCronChanges, toLogLimit } from './mappers/ops.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { CRON_BODY_LIMIT_BYTES, PUBLIC_CORS } from './constants/ops.constants';

/** HTTP adapter for status, health, docs, logs and heartbeat. */
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly cron: HeartbeatCron,
  ) {}

  root = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.overview());
  };

  health = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, await this.ops.health());
  };

  openApiSpec = async ({ res }: RouteContext): Promise<void> => {
    const spec = this.ops.openApiSpec();
    res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: ContentType.JSON, ...PUBLIC_CORS });
    res.end(spec);
  };

  docs = async ({ res }: RouteContext): Promise<void> => {
    res.writeHead(HttpStatus.OK, { [HttpHeader.CONTENT_TYPE]: ContentType.HTML });
    res.end(swaggerHtml());
  };

  logs = async ({ res, query }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { logs: this.ops.recentLogs(toLogLimit(query)) });
  };

  clearLogs = async ({ res }: RouteContext): Promise<void> => {
    this.ops.clearLogs();
    sendJson(res, HttpStatus.OK, { ok: true });
  };

  aiUsage = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.ops.aiUsage());
  };

  canvasAccounts = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { accounts: this.ops.canvasAccounts() });
  };

  cronStatus = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, this.cron.status());
  };

  updateCron = async ({ req, res }: RouteContext): Promise<void> => {
    const changes = toCronChanges(await readJsonBody(req, CRON_BODY_LIMIT_BYTES));
    sendJson(res, HttpStatus.OK, this.cron.update(changes));
  };
}
