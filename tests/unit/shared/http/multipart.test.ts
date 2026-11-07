import { describe, it, expect } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { parseMultipart } from '../../../../src/shared/http/multipart';
import { toVaultUploads } from '../../../../src/modules/vault/presentation/mappers/vault.mapper';

/** Regression: formidable lists files by write completion; uploads must still pair each file with its `path`. */
async function withServer<T>(fn: (port: number) => Promise<T>): Promise<T> {
  const server = http.createServer(async (req, res) => {
    const uploads = toVaultUploads(await parseMultipart(req));
    res.end(JSON.stringify(uploads.map((u) => [u.rawName, u.content])));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  try {
    return await fn((server.address() as AddressInfo).port);
  } finally {
    server.close();
  }
}

describe('parseMultipart keeps request order', () => {
  it('several small files (Vietnamese names) are never paired with another path — 40 uploads', async () => {
    const files: [string, string][] = [['_smoke/Bài 1.md', 'BAI'], ['_smoke/Bái 1.md', 'BAIS'], ['_smoke/mutex.md', 'MUTEX'], ['_smoke/d.md', 'D']];
    await withServer(async (port) => {
      for (let i = 0; i < 40; i++) {
        const form = new FormData();
        for (const [path, content] of files) {
          form.append('files', new Blob([content]), path.split('/').pop()!);
          form.append('path', path);
        }
        const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: form });
        expect(await res.json()).toEqual(files);
      }
    });
  }, 60_000);

  it('a large first file + small later files still line up with their path fields', async () => {
    const server = http.createServer(async (req, res) => {
      const uploads = toVaultUploads(await parseMultipart(req));
      res.end(JSON.stringify(uploads.map((u) => [u.rawName, u.content.slice(0, 12)])));
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    try {
      const form = new FormData();
      const files: [string, string][] = [
        ['f/big.md', `BIG-CONTENT ${'x'.repeat(3_000_000)}`],
        ['f/a.md', 'A-CONTENT'],
        ['f/b.md', 'B-CONTENT'],
        ['f/c.md', 'C-CONTENT'],
      ];
      for (const [path, content] of files) {
        form.append('files', new Blob([content]), path.split('/').pop()!);
        form.append('path', path);
      }
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: form });
      expect(await res.json()).toEqual([
        ['f/big.md', 'BIG-CONTENT '],
        ['f/a.md', 'A-CONTENT'],
        ['f/b.md', 'B-CONTENT'],
        ['f/c.md', 'C-CONTENT'],
      ]);
    } finally {
      server.close();
    }
  });

  it('an empty file does not reject the whole batch (it reaches the use case with empty content)', async () => {
    await withServer(async (port) => {
      const form = new FormData();
      for (const [path, content] of [['e/a.md', 'A'], ['e/empty.md', ''], ['e/b.md', 'B']]) {
        form.append('files', new Blob([content]), path.split('/').pop()!);
        form.append('path', path);
      }
      const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST', body: form });
      expect(await res.json()).toEqual([['e/a.md', 'A'], ['e/empty.md', ''], ['e/b.md', 'B']]);
    });
  });
});
