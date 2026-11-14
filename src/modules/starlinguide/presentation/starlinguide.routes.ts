import { HttpMethod } from '../../../shared/http/enums/http.enums';
import { exactPath, wildcardPath } from '../../../shared/http/helpers/router.helper';
import type { Route } from '../../../shared/http/interfaces/router.interface';
import type { StarlinguideController } from './starlinguide.controller';
import { StarlinguideApiPath } from './enums/starlinguide.enums';

/**
 * Auth is checked by the controller (capture key, fail-closed). This router must come BEFORE the capture
 * router: the capture router owns every `/api/captures/batches/*` path and would answer 405 to the re-push.
 */
export function createStarlinguideRoutes(controller: StarlinguideController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(StarlinguideApiPath.STATUS), handler: controller.status },
    { method: HttpMethod.POST, match: wildcardPath(StarlinguideApiPath.BATCH_PREFIX, StarlinguideApiPath.REPUSH_SUFFIX), handler: controller.repush },
  ];
}
