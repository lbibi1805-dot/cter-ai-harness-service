import { HttpMethod } from '../../../shared/http/enums/http.enums';
import { exactPath, wildcardPath } from '../../../shared/http/helpers/router.helper';
import type { PathMatcher, Route } from '../../../shared/http/interfaces/router.interface';
import type { CaptureController } from './capture.controller';
import { CaptureApiPath } from './enums/capture.enums';

const batchPath = wildcardPath(CaptureApiPath.BATCH_PREFIX);

/** `{folder}/{index}/images/{name}` under the batch prefix (listed before the batch DELETE). */
const imagePath: PathMatcher = (pathname) => {
  const match = batchPath(pathname);
  return match && match.path.split('/')[2] === CaptureApiPath.IMAGES_SEGMENT ? match : null;
};

/** Auth is checked by the controller (shared capture key, fail-closed), not by the Router's bearer check. */
export function createCaptureRoutes(controller: CaptureController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(CaptureApiPath.LIST), handler: controller.list },
    { method: HttpMethod.GET, match: exactPath(CaptureApiPath.FOLDERS), handler: controller.folders },
    { method: HttpMethod.POST, match: exactPath(CaptureApiPath.BATCHES), handler: controller.createBatch },
    { method: HttpMethod.POST, match: wildcardPath(CaptureApiPath.BATCH_PREFIX, CaptureApiPath.IMAGES_SUFFIX), handler: controller.addImage },
    { method: HttpMethod.GET, match: wildcardPath(CaptureApiPath.BATCH_PREFIX), handler: controller.getBatch },
    { method: HttpMethod.DELETE, match: imagePath, handler: controller.deleteImage },
    { method: HttpMethod.DELETE, match: batchPath, handler: controller.deleteBatch },
    { method: HttpMethod.GET, match: wildcardPath(CaptureApiPath.FILES_PREFIX), handler: controller.file },
  ];
}
