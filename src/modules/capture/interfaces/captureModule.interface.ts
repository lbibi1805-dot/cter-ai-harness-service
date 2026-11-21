import type { Router } from '../../../shared/http/router';
import type { ObjectStorage, ObjectStorageSettings } from '../../../shared/storage';
import type { CaptureService } from '../application/capture.service';
import type { CaptureImageSink } from '../application/interfaces/captureImageSink.interface';

/** CAPTURE_* settings (planning-13112026-photo-capture). */
export interface CaptureSettings {
  /** CAPTURE_API_KEY — read/delete key; also the on/off switch: unset = module disabled (503), uploads included. */
  apiKey?: string;
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
  /** Told about uploaded / deleted photos (planning-15112026-starlinguide-push). */
  sink?: CaptureImageSink;
}

export interface CaptureModule {
  /** Null when CAPTURE_API_KEY is not set. */
  service: CaptureService | null;
  router: Router;
}
