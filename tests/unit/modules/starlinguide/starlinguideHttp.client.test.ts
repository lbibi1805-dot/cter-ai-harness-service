import { describe, it, expect } from 'vitest';
import { SendStatus, StarlinguideHttpClient } from '../../../../src/modules/starlinguide';

const SECRET = 'test-secret-value';

function client(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return respond(url, init);
  }) as unknown as typeof fetch;
  return { seen, http: new StarlinguideHttpClient({ baseUrl: 'https://partner.test/uat', secret: SECRET, timeoutMs: 10_000, fetchImpl }) };
}

const FILES = [
  { fileName: 'bach-0007-01.jpg', mimeType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff]) },
  { fileName: 'bach-0007-02.png', mimeType: 'image/png', body: Buffer.from([0x89, 0x50]) },
];

describe('StarlinguideHttpClient (U12)', () => {
  it('posts multipart with repeated email/file fields and the secret header', async () => {
    const { seen, http } = client(() => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const result = await http.send(['a@x.com', 'B@x.com'], FILES);
    expect(result).toEqual({ status: SendStatus.OK, results: [] });
    expect(seen[0].url).toBe('https://partner.test/uat/partner/context-files');
    expect(seen[0].init.method).toBe('POST');
    expect((seen[0].init.headers as Record<string, string>)['X-Partner-Secret']).toBe(SECRET);
    const form = seen[0].init.body as FormData;
    expect(form.getAll('email')).toEqual(['a@x.com', 'B@x.com']);
    const files = form.getAll('file') as File[];
    expect(files.map((f) => [f.name, f.type, f.size])).toEqual([['bach-0007-01.jpg', 'image/jpeg', 3], ['bach-0007-02.png', 'image/png', 2]]);
  });

  it('maps request-level errors', async () => {
    const cases: Array<[number, SendStatus]> = [[400, SendStatus.BAD_REQUEST], [401, SendStatus.UNAUTHORIZED], [413, SendStatus.TOO_LARGE], [502, SendStatus.SERVER]];
    for (const [code, status] of cases) {
      const { http } = client(() => new Response('{"code":"X"}', { status: code }));
      expect((await http.send(['a@x.com'], FILES)).status).toBe(status);
    }
  });

  it('429 reads Retry-After, else retry_after_seconds', async () => {
    let { http } = client(() => new Response('{}', { status: 429, headers: { 'Retry-After': '7' } }));
    expect(await http.send(['a@x.com'], FILES)).toMatchObject({ status: SendStatus.RATE_LIMITED, retryAfterSeconds: 7 });
    ({ http } = client(() => new Response('{"retry_after_seconds":12}', { status: 429 })));
    expect(await http.send(['a@x.com'], FILES)).toMatchObject({ status: SendStatus.RATE_LIMITED, retryAfterSeconds: 12 });
  });

  it('network error and timeout never throw; 200 without results[] is a server error', async () => {
    let { http } = client(() => { throw new TypeError('fetch failed'); });
    expect(await http.send(['a@x.com'], FILES)).toMatchObject({ status: SendStatus.NETWORK, detail: 'fetch failed' });
    ({ http } = client(() => { throw Object.assign(new Error('timed out'), { name: 'TimeoutError' }); }));
    expect((await http.send(['a@x.com'], FILES)).status).toBe(SendStatus.TIMEOUT);
    ({ http } = client(() => new Response('<html>', { status: 200 })));
    expect((await http.send(['a@x.com'], FILES)).status).toBe(SendStatus.SERVER);
  });
});
