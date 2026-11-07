import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ObjectMetadataKey, ObjectStorageKind } from './enums/objectStorage.enums';
import { DELETE_BATCH_SIZE, R2_REGION } from './constants/objectStorage.constants';
import { assertValidKey, assertValidPrefix, sha256Hex, toBuffer } from './helpers/objectKey.helper';
import type { ObjectInfo, PutObjectOptions, R2Settings, StoredObject } from './interfaces/objectStorage.interface';
import type { ObjectStorage } from './objectStorage.port';

const NOT_FOUND_NAMES = new Set(['NoSuchKey', 'NotFound']);
const HTTP_NOT_FOUND = 404;
const MISSING_KEY_CODE = 'NoSuchKey';

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return NOT_FOUND_NAMES.has(e?.name ?? '') || e?.$metadata?.httpStatusCode === HTTP_NOT_FOUND;
}

/**
 * Cloudflare R2 through the S3 API. Checksums are only sent when an operation
 * requires them: recent SDKs add CRC headers by default, which R2 rejects on
 * some calls.
 */
export class R2ObjectStorage implements ObjectStorage {
  readonly kind = ObjectStorageKind.R2;
  readonly location: string;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(settings: R2Settings, client?: S3Client) {
    this.bucket = settings.bucket;
    this.location = `r2://${settings.bucket}`;
    this.client = client ?? new S3Client({
      region: R2_REGION,
      endpoint: settings.endpoint ?? `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
      // Path-style URLs (`https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`), like the R2 S3 endpoint.
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async put(key: string, body: Buffer | string, options: PutObjectOptions): Promise<void> {
    assertValidKey(key);
    const bytes = toBuffer(body);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: bytes,
      ContentType: options.contentType,
      ContentLength: bytes.length,
      Metadata: { ...options.metadata, [ObjectMetadataKey.SHA256]: sha256Hex(bytes) },
    }));
  }

  async get(key: string): Promise<StoredObject | null> {
    assertValidKey(key);
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = res.Body ? Buffer.from(await res.Body.transformToByteArray()) : Buffer.alloc(0);
      return { body: bytes, contentType: res.ContentType, metadata: res.Metadata ?? {} };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async head(key: string): Promise<ObjectInfo | null> {
    assertValidKey(key);
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { key, size: res.ContentLength ?? 0, lastModified: res.LastModified, metadata: res.Metadata ?? {} };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    assertValidKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]): Promise<void> {
    keys.forEach(assertValidKey);
    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      const batch = keys.slice(i, i + DELETE_BATCH_SIZE);
      const res = await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }));
      const failed = (res.Errors ?? []).filter((e) => e.Code !== MISSING_KEY_CODE);
      if (failed.length > 0) {
        throw new Error(`R2 deleteMany failed for ${failed.length} keys (first: ${failed[0].Key} ${failed[0].Code} ${failed[0].Message ?? ''})`);
      }
    }
  }

  async deletePrefix(prefix: string): Promise<number> {
    assertValidPrefix(prefix);
    const keys = (await this.list(prefix)).map((o) => o.key);
    if (keys.length > 0) await this.deleteMany(keys);
    return keys.length;
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    assertValidPrefix(prefix);
    const found: ObjectInfo[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      for (const o of res.Contents ?? []) if (o.Key) found.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified });
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return found;
  }

  presignGet(key: string, ttlSeconds: number): Promise<string | null> {
    assertValidKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: ttlSeconds });
  }
}
