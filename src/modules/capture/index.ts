import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import { createObjectStorage } from '../../shared/storage';
import { CaptureService } from './application/capture.service';
import { CAPTURE_MAX_IMAGES_PER_BATCH } from './domain';
import { CaptureController } from './presentation/capture.controller';
import { createCaptureRoutes } from './presentation/capture.routes';
import type { CaptureSettings, CaptureModuleDeps, CaptureModule } from './interfaces/captureModule.interface';

export type { CaptureSettings, CaptureModuleDeps, CaptureModule } from './interfaces/captureModule.interface';

/** Photo capture API `/api/captures` (public upload, read key for receivers, no database); the phone UI is `cter-capture-client`. */
export function createCaptureModule(settings: CaptureSettings, deps: CaptureModuleDeps = {}): CaptureModule {
  let service: CaptureService | null = null;
  if (settings.apiKey) {
    const storage = deps.storage ?? createObjectStorage(settings.storage);
    service = new CaptureService(storage, {
      urlTtlSeconds: settings.urlTtlSeconds,
      maxImagesPerBatch: CAPTURE_MAX_IMAGES_PER_BATCH,
      now: deps.now ?? Date.now,
      ...(deps.sink ? { sink: deps.sink } : {}),
    });
    logger.info(`[capture] enabled · storage ${storage.location}${settings.sharedBucket ? ' (shared main bucket, prefix captures/)' : ''}`);
  } else {
    logger.info('[capture] CAPTURE_API_KEY not set — /api/captures disabled');
  }
  const controller = new CaptureController(service, { apiKey: settings.apiKey, adminToken: deps.adminToken }, settings.maxImageBytes);
  return { service, router: new Router(createCaptureRoutes(controller), undefined) };
}

export { CaptureService } from './application/capture.service';
export * from './application/constants/captureService.constants';
export type * from './application/interfaces/captureService.interface';
export { CaptureApiPath } from './presentation/enums/capture.enums';
export type { CaptureImageSink, CaptureStoredImage } from './application/interfaces/captureImageSink.interface';
export type { CaptureKeys } from './presentation/interfaces/captureKeys.interface';
export { hasCaptureAccess, presentedKey } from './presentation/helpers/captureAuth.helper';
export { normalizeFolder, parseBatchIndex } from './domain';
