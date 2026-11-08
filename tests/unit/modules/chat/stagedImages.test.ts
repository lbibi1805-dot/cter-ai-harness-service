import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { Router } from '../../../../src/shared/http/router';
import { AnswerMode, type Answerer } from '../../../../src/modules/agent/domain';
import { ModelCatalog } from '../../../../src/modules/ai';
import { createChatModule, sniffImage, StagedImageService, STAGED_IMAGE_PREFIX, type ImageResizer } from '../../../../src/modules/chat';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { buildTestAiConfig } from '../../../support/configFixture';

const TOKEN = 'chat-secret';

/** A real PNG header (IHDR) with the given size; the rest is filler. */
function png(width: number, height: number): Buffer {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

function jpeg(width: number, height: number): Buffer {
  // SOI, APP0 (len 4), SOF0 (len 11: precision, height, width, …)
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0, 0, 0, 0]);
}

describe('sniffImage (magic bytes, header size)', () => {
  it('reads PNG, JPEG, GIF and WebP; rejects anything else', () => {
    expect(sniffImage(png(800, 600))).toEqual({ mimeType: 'image/png', width: 800, height: 600 });
    expect(sniffImage(jpeg(3000, 2000))).toEqual({ mimeType: 'image/jpeg', width: 3000, height: 2000 });
    expect(sniffImage(Buffer.from('GIF89a\x10\x00\x20\x00', 'latin1'))).toEqual({ mimeType: 'image/gif', width: 16, height: 32 });
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPVP8 '), Buffer.alloc(20)]))?.mimeType).toBe('image/webp');
    expect(sniffImage(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg/>'))).toBeNull();
  });
});

describe('StagedImageService', () => {
  let storage: FakeObjectStorage;
  let now: number;
  let resizer: ImageResizer & { resize: Mock };
  let service: StagedImageService;
  beforeEach(() => {
    storage = new FakeObjectStorage();
    now = 1_000_000;
    resizer = { resize: vi.fn(async (_data: Buffer, _mime: string, max: number) => ({ data: Buffer.from('small'), width: max, height: 1000 })) };
    service = new StagedImageService(storage, resizer, { ttlMs: 60_000, maxEntries: 3, now: () => now });
  });

  it('stores under tmp/uploads/, returns ids; resolves them in order; consume deletes the objects', async () => {
    const staged = await service.stage([{ data: png(10, 10), mimeType: 'image/jpeg' }, { data: jpeg(20, 30) }]);
    expect(staged).toEqual([
      { imageId: expect.any(String), mimeType: 'image/png', bytes: 64, width: 10, height: 10 },  // declared type ignored: magic bytes win
      { imageId: expect.any(String), mimeType: 'image/jpeg', bytes: 22, width: 20, height: 30 },
    ]);
    expect([...storage.objects.keys()].every((k) => k.startsWith(STAGED_IMAGE_PREFIX))).toBe(true);
    const images = await service.resolve([staged[1].imageId, staged[0].imageId]);
    expect(images.map((i) => i.mimeType)).toEqual(['image/jpeg', 'image/png']);
    service.consume(staged.map((s) => s.imageId));
    await vi.waitFor(() => expect(storage.objects.size).toBe(0));
    await expect(service.resolve([staged[0].imageId])).rejects.toThrow(/unknown or expired/);
  });

  it('rejects non-images (400) and unknown or expired ids', async () => {
    await expect(service.stage([{ data: Buffer.from('%PDF-1.7 …'), mimeType: 'image/png' }])).rejects.toThrow(/not a PNG, JPEG, GIF or WebP/);
    await expect(service.resolve(['../../vault/x'])).rejects.toThrow(/imageId returned by/);
    await expect(service.resolve(['8f14e45f-ceea-4e7b-9c5a-2d1b8f0e9a11'])).rejects.toThrow(/unknown or expired/);
    const [s] = await service.stage([{ data: png(5, 5) }]);
    now += 60_001;
    await expect(service.resolve([s.imageId])).rejects.toThrow(/expired/);
  });

  it('downscales only PNG/JPEG over 2048 px (to 1568), and keeps the original when decoding fails', async () => {
    const [big] = await service.stage([{ data: jpeg(4000, 2500) }]);
    expect(resizer.resize).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', 1568);
    expect(big).toMatchObject({ bytes: 5, width: 1568, height: 1000 });
    await service.stage([{ data: png(2048, 100) }]);
    expect(resizer.resize).toHaveBeenCalledTimes(1);
    resizer.resize.mockResolvedValueOnce(null);
    const [kept] = await service.stage([{ data: png(5000, 100) }]);
    expect(kept).toMatchObject({ bytes: 64, width: 5000 });
  });

  it('sweeps unconsumed uploads past the TTL only when an upload comes in (no timer)', async () => {
    const [old] = await service.stage([{ data: png(5, 5) }]);
    now += 120_000;
    expect(storage.objects.size).toBe(1);
    await service.stage([{ data: png(6, 6) }]);                     // opportunistic sweep
    await vi.waitFor(() => expect(storage.objects.has(`${STAGED_IMAGE_PREFIX}${old.imageId}`)).toBe(false));
    expect(service.size).toBe(1);
  });

  it('survives a restart: an id not in RAM is still served from storage (type from the magic bytes)', async () => {
    const [s] = await service.stage([{ data: png(7, 7) }]);
    const fresh = new StagedImageService(storage, null, { ttlMs: 60_000, maxEntries: 3, now: () => now });
    expect((await fresh.resolve([s.imageId]))[0].mimeType).toBe('image/png');
  });

  it('expandBody (for /api/c4) appends the uploads to `images` as base64', async () => {
    const [s] = await service.stage([{ data: png(8, 8) }]);
    const { body, imageIds } = await service.expandBody({ description: 'x', images: [{ mimeType: 'image/png', data: 'AAA=' }], imageIds: [s.imageId] }, 10);
    expect(imageIds).toEqual([s.imageId]);
    expect((body as { images: unknown[] }).images).toEqual([{ mimeType: 'image/png', data: 'AAA=' }, { mimeType: 'image/png', data: png(8, 8).toString('base64') }]);
    expect(await service.expandBody({ description: 'x' }, 10)).toEqual({ body: { description: 'x' }, imageIds: [] });
  });
});

describe('POST /api/chat/images + imageIds in /api/chat', () => {
  let answer: Mock<Answerer['answer']>;
  let router: Router;
  let storage: FakeObjectStorage;

  beforeEach(() => {
    answer = vi.fn<Answerer['answer']>().mockResolvedValue({ text: 'hi', model: 'gemini-2.0-flash', attempts: 1, mode: AnswerMode.SINGLE_SHOT, contexts: [] });
    storage = new FakeObjectStorage();
    const chat = createChatModule(
      { chatApiToken: TOKEN },
      { answers: { answer }, catalog: new ModelCatalog(buildTestAiConfig()), agentEnabled: false, isProviderConfigured: () => true, storage, resizer: null },
    );
    router = chat.router;
  });

  async function call(url: string, body: Buffer | unknown, contentType = 'application/json') {
    let status = 0;
    let text = '';
    const res = { writeHead: vi.fn((code: number) => { status = code; }), end: vi.fn((chunk: string) => { text = chunk; }) } as unknown as ServerResponse;
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
    const req = Object.assign(Readable.from([payload]), { method: 'POST', url, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': contentType } }) as unknown as IncomingMessage;
    await router.dispatch(req, res, new URL(url, 'http://localhost'));
    return { status, body: JSON.parse(text) };
  }

  it('JSON upload → imageIds in /api/chat → the model gets the bytes; the staged object is deleted after the answer', async () => {
    const up = await call('/api/chat/images', { images: [{ data: png(10, 10).toString('base64'), mimeType: 'image/png' }] });
    expect(up.status).toBe(200);
    const imageId = up.body.images[0].imageId as string;
    const res = await call('/api/chat', { provider: 'gemini', question: 'ảnh này?', imageIds: [imageId] });
    expect(res.status).toBe(200);
    expect(answer.mock.calls[0][0].content.imageBuffers[0].data.equals(png(10, 10))).toBe(true);
    await vi.waitFor(() => expect(storage.objects.size).toBe(0));
  });

  it('raw image/* body upload; 400 for a non-image, an unknown id, or too many images in total', async () => {
    const raw = await call('/api/chat/images', jpeg(40, 30), 'image/jpeg');
    expect(raw.body.images[0]).toMatchObject({ mimeType: 'image/jpeg', width: 40, height: 30 });
    expect((await call('/api/chat/images', Buffer.from('not an image'), 'image/png')).status).toBe(400);
    expect((await call('/api/chat', { provider: 'gemini', question: 'q', imageIds: ['8f14e45f-ceea-4e7b-9c5a-2d1b8f0e9a11'] })).status).toBe(400);
    const ten = Array.from({ length: 10 }, () => ({ mimeType: 'image/png', data: png(1, 1).toString('base64') }));
    expect((await call('/api/chat', { provider: 'gemini', question: 'q', images: ten, imageIds: [raw.body.images[0].imageId] })).status).toBe(400);
    expect(answer).not.toHaveBeenCalled();
  });

  it('a failed answer keeps the upload for a retry', async () => {
    const up = await call('/api/chat/images', { images: [{ data: png(3, 3).toString('base64') }] });
    answer.mockRejectedValueOnce(new Error('boom'));
    expect((await call('/api/chat', { provider: 'gemini', question: 'q', imageIds: [up.body.images[0].imageId] })).status).toBe(502);
    expect(storage.objects.size).toBe(1);
  });
});

describe('CanvasImageResizer (@napi-rs/canvas)', () => {
  it('downscales a real PNG to the target longest side and keeps PNG; garbage → null', async () => {
    const { createCanvas } = await import('@napi-rs/canvas');
    const { CanvasImageResizer } = await import('../../../../src/modules/chat');
    const source = await createCanvas(3000, 300).encode('png');
    const out = await new CanvasImageResizer().resize(source, 'image/png', 1568);
    expect(out).toMatchObject({ width: 1568, height: 157 });
    expect(sniffImage(out!.data)).toMatchObject({ mimeType: 'image/png', width: 1568 });
    expect(await new CanvasImageResizer().resize(Buffer.from('nope'), 'image/png', 1568)).toBeNull();
  });
});
