import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { createCaptureModule, type CaptureSettings } from '../../../../src/modules/capture';
import { LocalDiskObjectStorage } from '../../../../src/shared/storage';
import type { Router } from '../../../../src/shared/http/router';

const API_KEY = 'shared-read-key';
const ADMIN = 'admin-token';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 2)]);

let dir: string;
let router: Router;
let clock: number;

function settings(overrides: Partial<CaptureSettings> = {}): CaptureSettings {
  return { apiKey: API_KEY, storage: { r2: null, localDir: dir }, sharedBucket: false, urlTtlSeconds: 600, maxImageBytes: 1024, ...overrides };
}

function build(overrides: Partial<CaptureSettings> = {}) {
  router = createCaptureModule(settings(overrides), {
    adminToken: ADMIN, storage: new LocalDiskObjectStorage(dir), now: () => ++clock,
  }).router;
}

async function call(method: string, url: string, opts: { key?: string; body?: Buffer | object; contentType?: string } = {}) {
  let status = 0;
  let headers: Record<string, string> = {};
  let raw: Buffer = Buffer.alloc(0);
  const res = {
    headersSent: false,
    writeHead: (code: number, h?: Record<string, string>) => { status = code; headers = h ?? {}; },
    end: (chunk?: string | Buffer) => { raw = chunk === undefined ? Buffer.alloc(0) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); },
  } as unknown as ServerResponse;
  const body = opts.body === undefined ? [] : [Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(JSON.stringify(opts.body))];
  const reqHeaders: Record<string, string> = {};
  if (opts.key) reqHeaders['x-capture-key'] = opts.key;
  if (opts.contentType) reqHeaders['content-type'] = opts.contentType;
  const req = Object.assign(Readable.from(body), { method, url, headers: reqHeaders }) as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL(url, 'http://localhost'));
  const isJson = String(headers['Content-Type'] ?? '').includes('json');
  return { status, headers, raw, json: isJson && raw.length ? JSON.parse(raw.toString()) : null };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-'));
  clock = 1_700_000_000_000;
  build();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('capture routes', () => {
  it('read and delete routes are fail-closed: 401 without or with a wrong key', async () => {
    await call('POST', '/api/captures/batches/bach/1/images', { body: JPEG, contentType: 'image/jpeg' });
    for (const key of [undefined, 'nope']) {
      expect((await call('GET', '/api/captures', { key })).status).toBe(401);
      expect((await call('GET', '/api/captures/folders', { key })).status).toBe(401);
      expect((await call('GET', '/api/captures/batches/bach/1', { key })).status).toBe(401);
      expect((await call('DELETE', '/api/captures/batches/bach/1', { key })).status).toBe(401);
    }
    expect((await call('GET', '/api/captures', { key: API_KEY })).status).toBe(200);
    expect((await call('GET', '/api/captures', { key: ADMIN })).status).toBe(200);
  });

  it('uploads are public: no key needed', async () => {
    expect((await call('POST', '/api/captures/batches', { body: { folder: 'bach' } })).status).toBe(201);
    expect((await call('POST', '/api/captures/batches/bach/1/images', { body: JPEG, contentType: 'image/jpeg' })).status).toBe(201);
  });

  it('every route answers 503 without CAPTURE_API_KEY (module switch)', async () => {
    build({ apiKey: undefined });
    expect((await call('GET', '/api/captures', { key: API_KEY })).status).toBe(503);
    expect((await call('POST', '/api/captures/batches', { body: { folder: 'bach' } })).status).toBe(503);
    expect((await call('POST', '/api/captures/batches/bach/1/images', { body: JPEG, contentType: 'image/jpeg' })).status).toBe(503);
    expect((await call('DELETE', '/api/captures/batches/bach/1', { key: ADMIN })).status).toBe(503);
  });

  it('upload → list → download → incremental since → delete', async () => {
    const created = await call('POST', '/api/captures/batches', { body: { folder: 'Bách' } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: 'bach/1', folder: 'bach', index: 1, imageCount: 0 });

    const [a, b] = await Promise.all([
      call('POST', '/api/captures/batches/bach/1/images', { body: JPEG, contentType: 'image/jpeg' }),
      call('POST', '/api/captures/batches/bach/1/images', { body: PNG, contentType: 'image/png' }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(new Set([a.json.seq, b.json.seq])).toEqual(new Set([1, 2]));

    const list = await call('GET', '/api/captures', { key: API_KEY });
    expect(list.json.folders).toEqual([expect.objectContaining({ name: 'bach', batchCount: 1, imageCount: 2, latestIndex: 1 })]);
    expect(list.json.batches[0].images.map((i: { seq: number }) => i.seq)).toEqual([1, 2]);
    const first = list.json.batches[0].images[0];
    expect(first.url).toBeNull(); // local disk: no presigned URL
    expect(first.path).toMatch(/^\/api\/captures\/files\/bach\/1\/01-[a-f0-9]{6}\.(jpg|png)$/);

    const file = await call('GET', `${first.path}?key=${API_KEY}`);
    expect(file.status).toBe(200);
    expect([JPEG, PNG].some((buf) => buf.equals(file.raw))).toBe(true);

    const cursor = list.json.cursor;
    expect((await call('GET', `/api/captures?since=${encodeURIComponent(cursor)}`, { key: API_KEY })).json.batches).toEqual([]);
    await call('POST', '/api/captures/batches/bach/2/images', { body: JPEG, contentType: 'image/jpeg' });
    const delta = await call('GET', `/api/captures?since=${encodeURIComponent(cursor)}`, { key: API_KEY });
    expect(delta.json.batches.map((x: { id: string }) => x.id)).toEqual(['bach/2']);

    const removed = await call('DELETE', '/api/captures/batches/bach/1', { key: API_KEY });
    expect(removed.json).toEqual({ ok: true, deleted: 2 });
    expect((await call('GET', '/api/captures/batches/bach/1', { key: API_KEY })).status).toBe(404);
  });

  it('uploader deletes one image with its deleteToken (no key); wrong/other tokens are 403', async () => {
    const a = await call('POST', '/api/captures/batches/Bách/1/images', { body: JPEG, contentType: 'image/jpeg' });
    const b = await call('POST', '/api/captures/batches/bach/1/images', { body: PNG, contentType: 'image/png' });
    expect(a.json.deleteToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const urlA = `/api/captures/batches/bach/1/images/${a.json.name}`;

    expect((await call('DELETE', urlA)).status).toBe(403);
    expect((await call('DELETE', `${urlA}?token=nope`)).status).toBe(403);
    expect((await call('DELETE', `${urlA}?token=${b.json.deleteToken}`)).status).toBe(403); // token of another image
    expect((await call('DELETE', `${urlA}?token=${a.json.deleteToken}`)).json).toEqual({ ok: true });
    expect((await call('DELETE', `${urlA}?token=${a.json.deleteToken}`)).status).toBe(404);

    const batch = await call('GET', '/api/captures/batches/bach/1', { key: API_KEY });
    expect(batch.json.images.map((i: { name: string }) => i.name)).toEqual([b.json.name]);
    // The read key may delete any image; the batch route still works.
    expect((await call('DELETE', `/api/captures/batches/bach/1/images/${b.json.name}`, { key: API_KEY })).status).toBe(200);
    expect((await call('GET', '/api/captures/batches/bach/1', { key: API_KEY })).status).toBe(404);
  });

  it('rebuilds the index from storage after a restart', async () => {
    await call('POST', '/api/captures/batches/an/4/images', { body: JPEG, contentType: 'image/jpeg' });
    build();
    const list = await call('GET', '/api/captures?folder=an', { key: API_KEY });
    expect(list.json.batches.map((x: { id: string; imageCount: number }) => [x.id, x.imageCount])).toEqual([['an/4', 1]]);
    expect((await call('POST', '/api/captures/batches', { body: { folder: 'an' } })).json.index).toBe(5);
  });

  it('rejects non-images, empty and oversized bodies', async () => {
    expect((await call('POST', '/api/captures/batches/bach/1/images', { body: Buffer.from('hello world, not an image') })).status).toBe(400);
    expect((await call('POST', '/api/captures/batches/bach/1/images', { body: Buffer.alloc(0) })).status).toBe(400);
    expect((await call('POST', '/api/captures/batches/bach/1/images', { body: Buffer.concat([JPEG, Buffer.alloc(2048)]) })).status).toBe(413);
    expect((await call('POST', '/api/captures/batches/bach/x/images', { body: JPEG })).status).toBe(400);
  });
});
