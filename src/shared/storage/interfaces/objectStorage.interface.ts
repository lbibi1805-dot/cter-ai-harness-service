export interface PutObjectOptions {
  contentType: string;
  /** Extra metadata; `sha256` of the body is always added by the adapter. */
  metadata?: Record<string, string>;
}

export interface StoredObject {
  body: Buffer;
  contentType?: string;
  metadata: Record<string, string>;
}

export interface ObjectInfo {
  key: string;
  size: number;
  lastModified?: Date;
  metadata?: Record<string, string>;
}

/** R2 credentials (one token per bucket, Object Read & Write). */
export interface R2Settings {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Override for tests / S3-compatible emulators; default `https://{accountId}.r2.cloudflarestorage.com`. */
  endpoint?: string;
}

/** R2 when configured, otherwise files under `localDir` (dev/test). */
export interface ObjectStorageSettings {
  r2: R2Settings | null;
  localDir: string;
}
