import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { createCaptureModule, type CaptureImageSink, type CaptureModule } from '../../../../src/modules/capture';
import {
  SendStatus,
  StarlinguideForwarder,
  createStarlinguideRouter,
  type PartnerFile,
  type StarlinguidePartnerClient,
  type StarlinguideSendResult,
} from '../../../../src/modules/starlinguide';
import { LocalDiskObjectStorage } from '../../../../src/shared/storage';
import type { Router } from '../../../../src/shared/http/router';

const API_KEY = 'shared-read-key';
const ADMIN = 'admin-token';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const DELAY = 1_000;

class FakeClient implements StarlinguidePartnerClient {
  calls: Array<{ emails: string[]; files: string[] }> = [];
  async send(emails: readonly string[], files: readonly PartnerFile[]): Promise<StarlinguideSendResult> {
    this.calls.push({ emails: [...emails], files: files.map((f) => f.fileName) });
    return {
      status: SendStatus.OK,
      results: emails.flatMap((email) => files.map((f) => ({ email, name: f.fileName, file: { id: 1, name: f.fileName } }))),
    };
  }
}

let dir: string;
let client: FakeClient;
let forwarder: StarlinguideForwarder;
let capture: CaptureModule;
let routers: Router[];

function build(sink?: CaptureImageSink) {
  client = new FakeClient();
  let service: CaptureModule['service'] = null;
  forwarder = new StarlinguideForwarder(client, {
    readImage: (folder, index, name) => service!.readImage(folder, index, name),
  }, { emails: ['a@x.com'], flushDelayMs: DELAY, host: 'api.test' });
  capture = createCaptureModule(
    { apiKey: API_KEY, storage: { r2: null, localDir: dir }, sharedBucket: false, urlTtlSeconds: 600, maxImageBytes: 4096 },
    { adminToken: ADMIN, storage: new LocalDiskObjectStorage(dir), sink: sink ?? forwarder },
  );
  service = capture.service;
  routers = [createStarlinguideRouter(forwarder, capture.service, { apiKey: API_KEY, adminToken: ADMIN }), capture.router];
}

/** Same dispatch rule as HttpServer: the first router that owns the path. */
async function call(method: string, url: string, opts: { key?: string; body?: Buffer } = {}) {
  let status = 0;
  let raw = '';
  const res = {
    headersSent: false,
    writeHead: (code: number) => { status = code; },
    end: (chunk?: string | Buffer) => { raw = chunk === undefined ? '' : chunk.toString(); },
  } as unknown as ServerResponse;
  const headers: Record<string, string> = opts.key ? { 'x-capture-key': opts.key } : {};
  if (opts.body) headers['content-type'] = 'image/jpeg';
  const req = Object.assign(Readable.from(opts.body ? [opts.body] : []), { method, url, headers }) as unknown as IncomingMessage;
  const parsed = new URL(url, 'http://localhost');
  const router = routers.find((r) => r.matches(parsed.pathname))!;
  await router.dispatch(req, res, parsed);
  return { status, json: raw ? JSON.parse(raw) : null };
}

const upload = () => call('POST', '/api/captures/batches/bach/1/images', { body: JPEG });

/** Fires the debounce, then waits for the send (reading bytes from the local disk is real I/O). */
async function flush(ms = DELAY) {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.waitFor(() => expect(forwarder.status().sending).toBe(false));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starlinguide-'));
  build();
});
afterEach(() => {
  vi.useRealTimers();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('capture → Starlinguide', () => {
  it('a new upload is pushed with the real bytes and the partner file name', async () => {
    expect((await upload()).status).toBe(201);
    await flush();
    expect(client.calls).toEqual([{ emails: ['a@x.com'], files: ['bach-0001-01.jpg'] }]);
  });

  it('photos already in the bucket are never pushed, only new uploads (R6 / U7)', async () => {
    await upload();
    await upload();
    await flush();
    expect(client.calls).toHaveLength(1);

    // Restart: a new service indexes the 2 stored photos from storage.
    build();
    const listed = await call('GET', '/api/captures', { key: API_KEY });
    expect(listed.json.batches[0].imageCount).toBe(2);
    await flush(10 * DELAY);
    expect(client.calls).toHaveLength(0);

    await upload();
    await flush();
    expect(client.calls).toEqual([{ emails: ['a@x.com'], files: ['bach-0001-03.jpg'] }]);
  });

  it('a failing listener never fails the upload (U9)', async () => {
    build({ imageStored: () => { throw new Error('boom'); }, imageDeleted: () => { throw new Error('boom'); } });
    expect((await upload()).status).toBe(201);
    expect((await call('DELETE', '/api/captures/batches/bach/1', { key: API_KEY })).status).toBe(200);
  });

  it('status and re-push need the capture key or ADMIN_TOKEN (U11)', async () => {
    expect((await call('GET', '/api/captures/starlinguide/status')).status).toBe(401);
    expect((await call('POST', '/api/captures/batches/bach/1/starlinguide', { key: 'nope' })).status).toBe(401);
    const status = await call('GET', '/api/captures/starlinguide/status', { key: ADMIN });
    expect(status.status).toBe(200);
    expect(status.json).toMatchObject({ enabled: true, emails: ['a***@x.com'] });
  });

  it('re-push queues every photo of one batch again', async () => {
    await upload();
    await upload();
    await flush();
    const repush = await call('POST', '/api/captures/batches/bach/1/starlinguide', { key: API_KEY });
    expect(repush.status).toBe(202);
    expect(repush.json).toMatchObject({ ok: true, batch: 'bach/1', queued: 2, skipped: 0 });
    await flush();
    expect(client.calls[1].files).toEqual(['bach-0001-01.jpg', 'bach-0001-02.jpg']);
    expect((await call('POST', '/api/captures/batches/bach/9/starlinguide', { key: API_KEY })).status).toBe(404);
  });

  it('status says disabled when the feature is off', async () => {
    routers = [createStarlinguideRouter(null, capture.service, { apiKey: API_KEY }), capture.router];
    expect((await call('GET', '/api/captures/starlinguide/status', { key: API_KEY })).json).toEqual({ enabled: false });
    expect((await call('POST', '/api/captures/batches/bach/1/starlinguide', { key: API_KEY })).status).toBe(503);
  });
});
