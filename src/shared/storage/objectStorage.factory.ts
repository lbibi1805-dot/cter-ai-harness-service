import * as path from 'path';
import { logger } from '../logging/logger';
import type { ObjectStorageSettings } from './interfaces/objectStorage.interface';
import { LocalDiskObjectStorage } from './localDiskObjectStorage.adapter';
import type { ObjectStorage } from './objectStorage.port';
import { R2ObjectStorage } from './r2ObjectStorage.adapter';

/** R2 when the R2_* variables are set; otherwise a local directory (dev/test only: Render's disk is ephemeral). */
export function createObjectStorage(settings: ObjectStorageSettings): ObjectStorage {
  if (settings.r2) {
    logger.info(`[storage] object storage: R2 bucket "${settings.r2.bucket}"`);
    return new R2ObjectStorage(settings.r2);
  }
  const dir = path.resolve(process.cwd(), settings.localDir);
  logger.info(`[storage] object storage: local disk ${dir} (set R2_* for Cloudflare R2)`);
  return new LocalDiskObjectStorage(dir);
}
