import { HttpMethod } from '../../../shared/http/enums/http.enums';
import type { PollingController } from './polling.controller';
import { exactPath } from '../../../shared/http/helpers/router.helper';
import { Route } from '../../../shared/http/interfaces/router.interface';
import { PollingApiPath } from './enums/polling.enums';

/** `/start` and `/stop` stay unauthenticated GETs for backward compatibility with existing clients. */
export function createPollingRoutes(controller: PollingController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.START), handler: controller.start },
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.STOP), handler: controller.stop },
    { method: HttpMethod.GET, match: exactPath(PollingApiPath.STATUS), handler: controller.status },
  ];
}
