import type { ObjectStorageKind } from './enums/objectStorage.enums';
import type { ObjectInfo, PutObjectOptions, StoredObject } from './interfaces/objectStorage.interface';

/**
 * Object storage (Cloudflare R2 in prod, local disk in dev/test). Keys must
 * start with an `ObjectPrefix`; every adapter validates them, so a bad key can
 * never touch objects outside the app's prefixes. All deletes are idempotent.
 */
export interface ObjectStorage {
  readonly kind: ObjectStorageKind;
  /** Where objects live, for logs and safety checks (bucket name or directory). */
  readonly location: string;
  put(key: string, body: Buffer | string, options: PutObjectOptions): Promise<void>;
  /** Null when the key does not exist. */
  get(key: string): Promise<StoredObject | null>;
  /** Null when the key does not exist. */
  head(key: string): Promise<ObjectInfo | null>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  /** Deletes every object under `prefix` (must end with "/"); returns how many were deleted. */
  deletePrefix(prefix: string): Promise<number>;
  list(prefix: string): Promise<ObjectInfo[]>;
  /** Short-lived GET URL; null when the backend cannot serve one (local disk). */
  presignGet(key: string, ttlSeconds: number): Promise<string | null>;
}
