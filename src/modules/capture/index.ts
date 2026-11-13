import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import { createObjectStorage, type ObjectStorage, type ObjectStorageSettings } from '../../shared/storage';
import { CaptureService } from './application/capture.service';
import { CAPTURE_MAX_IMAGES_PER_BATCH } from './domain';
import { CaptureController } from './presentation/capture.controller';
import { createCaptureRoutes } from './presentation/capture.routes';

/** CAPTURE_* settings (planning-13112026-photo-capture). */
export interface CaptureSettings {
  /** CAPTURE_API_KEY — unset = module disabled (503). */
  apiKey?: string;
  /** CAPTURE_UPLOAD_KEY — optional; defaults to apiKey. */
  uploadKey?: string;
  /** Own bucket (CAPTURE_R2_*), else the main R2 bucket, else local disk (dev). */
  storage: ObjectStorageSettings;
  /** True when `storage` is the main R2 bucket (no CAPTURE_R2_BUCKET). */
  sharedBucket: boolean;
  urlTtlSeconds: number;
  maxImageBytes: number;
}

export interface CaptureModuleDeps {
  adminToken?: string;
  /** Test hooks. */
  storage?: ObjectStorage;
  now?: () => number;
}

export interface CaptureModule {
  /** Null when CAPTURE_API_KEY is not set. */
  service: CaptureService | null;
  router: Router;
}

/** Photo capture API `/api/captures` (shared key, no database); the phone UI is `cter-capture-client`. */
export function createCaptureModule(settings: CaptureSettings, deps: CaptureModuleDeps = {}): CaptureModule {
  let service: CaptureService | null = null;
  if (settings.apiKey) {
    const storage = deps.storage ?? createObjectStorage(settings.storage);
    service = new CaptureService(storage, {
      urlTtlSeconds: settings.urlTtlSeconds,
      maxImagesPerBatch: CAPTURE_MAX_IMAGES_PER_BATCH,
      now: deps.now ?? Date.now,
    });
    logger.info(`[capture] enabled · storage ${storage.location}${settings.sharedBucket ? ' (shared main bucket, prefix captures/)' : ''}`);
  } else {
    logger.info('[capture] CAPTURE_API_KEY not set — /api/captures disabled');
  }
  const controller = new CaptureController(service, { apiKey: settings.apiKey, uploadKey: settings.uploadKey, adminToken: deps.adminToken }, settings.maxImageBytes);
  return { service, router: new Router(createCaptureRoutes(controller), undefined) };
}

export { CaptureService } from './application/capture.service';
export * from './application/constants/captureService.constants';
export type * from './application/interfaces/captureService.interface';
export { CaptureApiPath } from './presentation/enums/capture.enums';
