import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotFoundError } from '../../../../src/shared/errors';
import type { CaptureStoredImage } from '../../../../src/modules/capture';
import {
  SendStatus,
  StarlinguideForwarder,
  type PartnerFile,
  type PartnerImageRef,
  type PartnerResult,
  type StarlinguidePartnerClient,
  type StarlinguideSendResult,
} from '../../../../src/modules/starlinguide';

const EMAILS = ['a@x.com', 'b@x.com'];
const DELAY = 5_000;

interface Call { emails: string[]; files: string[] }

/** Answers with the queued replies (default: every pair OK). */
class FakeClient implements StarlinguidePartnerClient {
  calls: Call[] = [];
  replies: Array<(emails: readonly string[], files: readonly PartnerFile[]) => StarlinguideSendResult> = [];
  async send(emails: readonly string[], files: readonly PartnerFile[]): Promise<StarlinguideSendResult> {
    this.calls.push({ emails: [...emails], files: files.map((f) => f.fileName) });
    const reply = this.replies.shift();
    return reply ? reply(emails, files) : ok(emails, files);
  }
}

function ok(emails: readonly string[], files: readonly PartnerFile[], fail: Record<string, string> = {}): StarlinguideSendResult {
  const results: PartnerResult[] = [];
  for (const email of emails) {
    for (const file of files) {
      const code = fail[`${email}|${file.fileName}`];
      results.push(code ? { email, name: file.fileName, error: { code, message: code } } : { email, name: file.fileName, file: { id: 1, name: file.fileName } });
    }
  }
  return { status: SendStatus.OK, results };
}

const JPEG_TYPE = 'image/jpeg' as CaptureStoredImage['mimeType'];

function photo(seq: number, overrides: Partial<PartnerImageRef> = {}): CaptureStoredImage {
  return { folder: 'bach', index: 7, seq, name: `${String(seq).padStart(2, '0')}-abcdef.jpg`, mimeType: JPEG_TYPE, bytes: 1000, ...overrides } as CaptureStoredImage;
}

let client: FakeClient;
let deleted: Set<string>;
let forwarder: StarlinguideForwarder;

function build(emails = EMAILS) {
  forwarder = new StarlinguideForwarder(client, {
    readImage: async (folder, index, name) => {
      if (deleted.has(`${folder}/${index}/${name}`)) throw new NotFoundError('gone');
      return { body: Buffer.from(name) };
    },
  }, { emails, flushDelayMs: DELAY, host: 'api.test' });
}

beforeEach(() => {
  vi.useFakeTimers();
  client = new FakeClient();
  deleted = new Set();
  build();
});
afterEach(() => vi.useRealTimers());

describe('StarlinguideForwarder', () => {
  it('debounces: 5 photos within 2 s → one request after 5 s of quiet, every email (U4)', async () => {
    for (let i = 1; i <= 5; i++) {
      forwarder.imageStored(photo(i));
      await vi.advanceTimersByTimeAsync(400);
    }
    expect(client.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(client.calls).toEqual([{ emails: EMAILS, files: ['bach-0007-01.jpg', 'bach-0007-02.jpg', 'bach-0007-03.jpg', 'bach-0007-04.jpg', 'bach-0007-05.jpg'] }]);
    expect(forwarder.status().counters).toMatchObject({ requests: 1, pairsOk: 10, pairsFailed: 0 });
  });

  it('sends at once when 20 photos fill a request; the rest follow after the delay', async () => {
    for (let i = 1; i <= 23; i++) forwarder.imageStored(photo(i));
    await vi.advanceTimersByTimeAsync(0);
    expect(client.calls.map((c) => c.files.length)).toEqual([20]);
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(client.calls.map((c) => c.files.length)).toEqual([20, 3]);
  });

  it('nothing is sent without a new upload (photos already in the bucket never reach the sink) (U7)', async () => {
    await vi.advanceTimersByTimeAsync(10 * DELAY);
    expect(client.calls).toHaveLength(0);
    expect(forwarder.status().pendingFiles).toBe(0);
  });

  it('INTERNAL_SERVER_ERROR: only that pair is resent, alone; permanent errors are not (U5)', async () => {
    client.replies.push((emails, files) => ok(emails, files, {
      'b@x.com|bach-0007-01.jpg': 'INTERNAL_SERVER_ERROR',
      'a@x.com|bach-0007-02.jpg': 'RESOURCE_NOT_FOUND',
    }));
    forwarder.imageStored(photo(1));
    forwarder.imageStored(photo(2));
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(client.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.calls[1]).toEqual({ emails: ['b@x.com'], files: ['bach-0007-01.jpg'] });
    const status = forwarder.status();
    expect(status.counters.pairsOk).toBe(3);
    expect(status.counters.failuresByCode).toEqual({ RESOURCE_NOT_FOUND: 1 });
    expect(status.lastError?.message).toContain('a***@x.com');
  });

  it('a pair failing every time gives up after 3 retries', async () => {
    for (let i = 0; i < 4; i++) client.replies.push((emails, files) => ok(emails, files, { 'a@x.com|bach-0007-01.jpg': 'INTERNAL_SERVER_ERROR' }));
    build(['a@x.com']);
    forwarder.imageStored(photo(1));
    await vi.advanceTimersByTimeAsync(DELAY + 10_000 + 60_000 + 300_000 + 1);
    expect(client.calls).toHaveLength(4);
    expect(forwarder.status().counters).toMatchObject({ pairsFailed: 1, failuresByCode: { INTERNAL_SERVER_ERROR: 1 } });
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(client.calls).toHaveLength(4);
  });

  it('429 waits Retry-After then resends the whole request (U6)', async () => {
    client.replies.push(() => ({ status: SendStatus.RATE_LIMITED, retryAfterSeconds: 12 }));
    forwarder.imageStored(photo(1));
    await vi.advanceTimersByTimeAsync(DELAY);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(client.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1]).toEqual(client.calls[0]);
  });

  it('5xx / network: whole request resent up to 3 times; timeout only once (U6)', async () => {
    for (let i = 0; i < 4; i++) client.replies.push(() => ({ status: SendStatus.SERVER, detail: 'HTTP 502' }));
    forwarder.imageStored(photo(1));
    await vi.advanceTimersByTimeAsync(DELAY + 5_000 + 30_000 + 120_000 + 1);
    expect(client.calls).toHaveLength(4);
    expect(forwarder.status().counters.failuresByCode).toEqual({ server: 2 });

    client = new FakeClient();
    build();
    client.replies.push(() => ({ status: SendStatus.TIMEOUT }), () => ({ status: SendStatus.TIMEOUT }));
    forwarder.imageStored(photo(1));
    await vi.advanceTimersByTimeAsync(DELAY + 5_000 + 1);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(client.calls).toHaveLength(2);
    expect(forwarder.status().counters.failuresByCode).toEqual({ timeout: 2 });
  });

  it('401 stops sending until restart; later photos are dropped (U6)', async () => {
    client.replies.push(() => ({ status: SendStatus.UNAUTHORIZED }));
    forwarder.imageStored(photo(1));
    await vi.advanceTimersByTimeAsync(DELAY);
    forwarder.imageStored(photo(2));
    await vi.advanceTimersByTimeAsync(10 * DELAY);
    expect(client.calls).toHaveLength(1);
    const status = forwarder.status();
    expect(status.blocked).toMatch(/401/);
    expect(status.counters.filesDropped).toBe(1);
  });

  it('a photo deleted before the flush is not sent (U8)', async () => {
    forwarder.imageStored(photo(1));
    forwarder.imageStored(photo(2));
    forwarder.imageDeleted('bach', 7, '01-abcdef.jpg');
    deleted.add('bach/7/02-abcdef.jpg');
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(client.calls).toHaveLength(0);
  });

  it('413 splits the request in two', async () => {
    client.replies.push(() => ({ status: SendStatus.TOO_LARGE }));
    for (let i = 1; i <= 4; i++) forwarder.imageStored(photo(i));
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(client.calls.map((c) => c.files.length)).toEqual([4, 2, 2]);
  });

  it('enqueue (re-push) skips duplicates and photos over 20 MB', () => {
    const outcome = forwarder.enqueue([photo(1), photo(1), photo(2, { bytes: 21 * 1024 * 1024 })]);
    expect(outcome).toEqual({ queued: 1, skipped: 2 });
  });

  it('shutdown sends what is waiting right away', async () => {
    forwarder.imageStored(photo(1));
    await forwarder.shutdown(1_000);
    expect(client.calls).toHaveLength(1);
  });

  it('status masks emails and never shows the secret', () => {
    expect(forwarder.status()).toMatchObject({ enabled: true, host: 'api.test', emails: ['a***@x.com', 'b***@x.com'], blocked: null });
  });
});
