import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  InvalidObjectKeyError,
  LocalDiskObjectStorage,
  R2ObjectStorage,
  assertValidKey,
  assertValidPrefix,
  sha256Hex,
  type ObjectStorage,
} from '../../../../src/shared/storage';

describe('object keys', () => {
  it('accepts keys under the known prefixes only', () => {
    expect(() => assertValidKey('vault/doc/abc.md')).not.toThrow();
    expect(() => assertValidKey('conversations/c/a.png')).not.toThrow();
    for (const bad of ['', 'vault/', 'other/x', '/vault/x', 'vault/../secret', 'vault//x', 'vault\\x', 'vault/./x', 'x'.repeat(2000)]) {
      expect(() => assertValidKey(bad), bad).toThrow(InvalidObjectKeyError);
    }
  });

  it('a prefix delete can never target the bucket root', () => {
    expect(() => assertValidPrefix('vault/')).not.toThrow();
    expect(() => assertValidPrefix('vault/doc-1/')).not.toThrow();
    for (const bad of ['', '/', 'vault', 'unknown/', '../']) expect(() => assertValidPrefix(bad), bad).toThrow(InvalidObjectKeyError);
  });
});

/** The same behaviour contract for every ObjectStorage adapter (note 11: contract tests). */
function contract(name: string, make: () => Promise<{ storage: ObjectStorage; cleanup(): Promise<void> }>): void {
  describe(`ObjectStorage contract: ${name}`, () => {
    let storage: ObjectStorage;
    let cleanup: () => Promise<void>;
    beforeEach(async () => ({ storage, cleanup } = await make()));
    afterEach(async () => cleanup());

    it('put/get/head round-trip with sha256 metadata', async () => {
      await storage.put('vault/d1/h1.md', 'xin chào', { contentType: 'text/markdown', metadata: { 'doc-id': 'd1' } });
      const got = await storage.get('vault/d1/h1.md');
      expect(got?.body.toString('utf-8')).toBe('xin chào');
      expect(got?.metadata).toMatchObject({ 'doc-id': 'd1', sha256: sha256Hex('xin chào') });
      expect((await storage.head('vault/d1/h1.md'))?.size).toBe(Buffer.byteLength('xin chào'));
    });

    it('missing keys read as null; deletes are idempotent', async () => {
      expect(await storage.get('vault/none/x.md')).toBeNull();
      expect(await storage.head('vault/none/x.md')).toBeNull();
      await expect(storage.delete('vault/none/x.md')).resolves.toBeUndefined();
      await expect(storage.deleteMany(['vault/none/x.md'])).resolves.toBeUndefined();
      expect(await storage.deletePrefix('vault/none/')).toBe(0);
    });

    it('list and deletePrefix only touch that prefix', async () => {
      for (const key of ['vault/a/1.md', 'vault/a/2.md', 'vault/ab/3.md', 'derived/a/x.md']) await storage.put(key, key, { contentType: 'text/plain' });
      expect((await storage.list('vault/a/')).map((o) => o.key)).toEqual(['vault/a/1.md', 'vault/a/2.md']);
      expect(await storage.deletePrefix('vault/a/')).toBe(2);
      expect((await storage.list('vault/')).map((o) => o.key)).toEqual(['vault/ab/3.md']);
      expect((await storage.list('derived/')).map((o) => o.key)).toEqual(['derived/a/x.md']);
    });

    it('rejects invalid keys before any I/O', async () => {
      await expect(storage.put('../escape', 'x', { contentType: 'text/plain' })).rejects.toThrow(InvalidObjectKeyError);
      await expect(storage.deletePrefix('')).rejects.toThrow(InvalidObjectKeyError);
    });
  });
}

contract('LocalDiskObjectStorage', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'objects-'));
  return { storage: new LocalDiskObjectStorage(dir), cleanup: async () => fs.rmSync(dir, { recursive: true, force: true }) };
});

/** R2 through a mocked S3 client that behaves like a tiny bucket. */
contract('R2ObjectStorage (mocked S3)', async () => {
  const bucket = new Map<string, { body: Buffer; type?: string; meta: Record<string, string> }>();
  const client = new S3Client({ region: 'auto', credentials: { accessKeyId: 'a', secretAccessKey: 'b' } });
  const s3 = mockClient(client);
  s3.on(PutObjectCommand).callsFake((input) => { bucket.set(input.Key, { body: Buffer.from(input.Body), type: input.ContentType, meta: input.Metadata ?? {} }); return {}; });
  s3.on(GetObjectCommand).callsFake((input) => {
    const o = bucket.get(input.Key);
    if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return { Body: { transformToByteArray: async () => new Uint8Array(o.body) } as never, ContentType: o.type, Metadata: o.meta };
  });
  s3.on(HeadObjectCommand).callsFake((input) => {
    const o = bucket.get(input.Key);
    if (!o) throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    return { ContentLength: o.body.length, Metadata: o.meta };
  });
  s3.on(ListObjectsV2Command).callsFake((input) => ({
    Contents: [...bucket.keys()].filter((k) => k.startsWith(input.Prefix)).sort().map((Key) => ({ Key, Size: bucket.get(Key)!.body.length })),
    IsTruncated: false,
  }));
  s3.on(DeleteObjectsCommand).callsFake((input) => { for (const o of input.Delete.Objects) bucket.delete(o.Key); return { Errors: [] }; });
  return {
    storage: new R2ObjectStorage({ accountId: 'acc', accessKeyId: 'a', secretAccessKey: 'b', bucket: 'cter-dev' }, client),
    cleanup: async () => { s3.restore(); },
  };
});

describe('R2ObjectStorage specifics', () => {
  it('sends checksums only when required and surfaces partial DeleteObjects failures', async () => {
    const client = new S3Client({ region: 'auto', credentials: { accessKeyId: 'a', secretAccessKey: 'b' } });
    const s3 = mockClient(client);
    s3.on(DeleteObjectsCommand).resolves({ Errors: [{ Key: 'vault/a/1.md', Code: 'InternalError', Message: 'boom' }] });
    const r2 = new R2ObjectStorage({ accountId: 'acc', accessKeyId: 'a', secretAccessKey: 'b', bucket: 'cter-dev' }, client);
    await expect(r2.deleteMany(['vault/a/1.md'])).rejects.toThrow(/deleteMany failed for 1 keys/);
    s3.restore();

    const real = new R2ObjectStorage({ accountId: 'acc', accessKeyId: 'a', secretAccessKey: 'b', bucket: 'cter-dev' });
    const config = (real as unknown as { client: S3Client }).client.config;
    expect(await config.requestChecksumCalculation()).toBe('WHEN_REQUIRED');
    expect(await config.responseChecksumValidation()).toBe('WHEN_REQUIRED');
    expect(real.location).toBe('r2://cter-dev');
    const url = await real.presignGet('conversations/c/a.png', 600);
    expect(url).toMatch(/^https:\/\/acc\.r2\.cloudflarestorage\.com\/cter-dev\/conversations\/c\/a\.png\?.*X-Amz-Expires=600/);
  });
});
