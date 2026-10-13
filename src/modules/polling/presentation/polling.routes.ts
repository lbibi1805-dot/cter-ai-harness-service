import { HttpMethod } from '../../../shared/http/http.enums';
import { exactPath, type Route } from '../../../shared/http/router';
import type { PollingController } from './polling.controller';

export enum PollingApiPath {
  START = '/start',
  STOP = '/stop',
  STATUS = '/api/polling',
}

/** `/start` and `/stop` stay unauthenticated GETs for backward compatibility with existing clients. */
export function createPollingRoutes(controller: PollingController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.START), handler: controller.start },
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.STOP), handler: controller.stop },
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.STATUS), handler: controller.status },
  ];
}
