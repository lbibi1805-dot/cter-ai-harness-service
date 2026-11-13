import {
  DEFAULT_CAPTURE_MAX_IMAGE_MB,
  DEFAULT_CAPTURE_STORAGE_DIR,
  DEFAULT_CAPTURE_URL_TTL_SECONDS,
  type CaptureSettings,
} from '../../../modules/capture';
import { readInt, readOptionalString, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';
import type { ObjectStorageSettings } from '../../../shared/storage';

const BYTES_PER_MB = 1024 * 1024;
/** Presigned R2 URLs live at most 7 days. */
const MAX_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

function inRange(name: string, value: number, min: number, max: number): number {
  if (value < min || value > max) throw new ConfigurationError(`${name} must be between ${min} and ${max}, got ${value}`);
  return value;
}

/**
 * Photo capture (planning-13112026-photo-capture). Storage, first match wins:
 * 1. CAPTURE_R2_BUCKET → own bucket; credentials CAPTURE_R2_* or, when unset, the main R2_* ones.
 * 2. Main R2 configured → same bucket, prefix `captures/`.
 * 3. Otherwise local disk CAPTURE_STORAGE_DIR (dev only: Render's disk is wiped on deploy).
 */
export function readCaptureConfig(mainStorage: ObjectStorageSettings): CaptureSettings {
  const localDir = readString('CAPTURE_STORAGE_DIR', DEFAULT_CAPTURE_STORAGE_DIR);
  const bucket = readOptionalString('CAPTURE_R2_BUCKET');
  let storage: ObjectStorageSettings;
  if (bucket) {
    const accountId = readOptionalString('CAPTURE_R2_ACCOUNT_ID') ?? mainStorage.r2?.accountId ?? readOptionalString('R2_ACCOUNT_ID');
    const accessKeyId = readOptionalString('CAPTURE_R2_ACCESS_KEY_ID') ?? mainStorage.r2?.accessKeyId;
    const secretAccessKey = readOptionalString('CAPTURE_R2_SECRET_ACCESS_KEY') ?? mainStorage.r2?.secretAccessKey;
    const missing = [
      ['CAPTURE_R2_ACCOUNT_ID (or R2_ACCOUNT_ID)', accountId],
      ['CAPTURE_R2_ACCESS_KEY_ID (or R2_ACCESS_KEY_ID)', accessKeyId],
      ['CAPTURE_R2_SECRET_ACCESS_KEY (or R2_SECRET_ACCESS_KEY)', secretAccessKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length > 0) throw new ConfigurationError(`CAPTURE_R2_BUCKET is set but missing ${missing.join(', ')}`);
    storage = {
      r2: { accountId: accountId!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket, endpoint: readOptionalString('CAPTURE_R2_ENDPOINT') ?? mainStorage.r2?.endpoint },
      localDir,
    };
  } else {
    storage = { r2: mainStorage.r2, localDir };
  }
  return {
    apiKey: readOptionalString('CAPTURE_API_KEY'),
    uploadKey: readOptionalString('CAPTURE_UPLOAD_KEY'),
    storage,
    sharedBucket: !bucket && !!mainStorage.r2,
    urlTtlSeconds: inRange('CAPTURE_URL_TTL_SECONDS', readInt('CAPTURE_URL_TTL_SECONDS', DEFAULT_CAPTURE_URL_TTL_SECONDS), 60, MAX_URL_TTL_SECONDS),
    maxImageBytes: inRange('CAPTURE_MAX_IMAGE_MB', readInt('CAPTURE_MAX_IMAGE_MB', DEFAULT_CAPTURE_MAX_IMAGE_MB), 1, 50) * BYTES_PER_MB,
  };
}
