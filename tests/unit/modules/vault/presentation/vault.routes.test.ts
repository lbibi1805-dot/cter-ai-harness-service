import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import { Router } from '../../../../../src/shared/http/router';
import { NotFoundError, ValidationError } from '../../../../../src/shared/errors';
import type { VaultService } from '../../../../../src/modules/vault/application/vault.service';
import type { VaultIndexingService } from '../../../../../src/modules/vault/application/vaultIndexing.service';
import { ReindexOutcome, VectorSyncResult } from '../../../../../src/modules/vault/domain';
import { VaultController } from '../../../../../src/modules/vault/presentation/vault.controller';
import { createVaultRoutes } from '../../../../../src/modules/vault/presentation/vault.routes';

const ADMIN_TOKEN = 'secret';

/** Service double: "missing" cases throw the same typed errors the real VaultService throws. */
function makeService() {
  return {
    searchFiles: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getFile: vi.fn().mockRejectedValue(new NotFoundError('Not found')),
    listFolders: vi.fn().mockResolvedValue([]),
    listChunkIds: vi.fn().mockResolvedValue({ total: 0, chunkIds: [] }),
    getFileChunks: vi.fn().mockRejectedValue(new NotFoundError('File not found')),
    uploadFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockRejectedValue(new NotFoundError('Not found')),
    deleteFolder: vi.fn().mockRejectedValue(new NotFoundError('Folder not found or empty')),
    deleteAll: vi.fn().mockResolvedValue(0),
    renameFile: vi.fn(),
  };
}

function makeIndexing() {
  return {
    scheduleAfterUpload: vi.fn(),
    requestManualReindex: vi.fn().mockReturnValue(ReindexOutcome.STARTED),
  };
}

let service: ReturnType<typeof makeService>;
let indexing: ReturnType<typeof makeIndexing>;
let router: Router;
let reconcile: ReturnType<typeof vi.fn>;

async function call(method: string, url: string, headers: Record<string, string> = {}) {
  let status = 0;
  let body = '';
  const res = {
    writeHead: vi.fn((code: number) => { status = code; }),
    end: vi.fn((chunk: string) => { body = chunk; }),
  } as unknown as ServerResponse;
  const req = { method, url, headers: { authorization: `Bearer ${ADMIN_TOKEN}`, ...headers } } as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL(url, 'http://localhost'));
  return { status, body: JSON.parse(body) };
}

/** A request with a JSON body (the rename route reads one). */
async function makeJsonCall(method: string, url: string, body: unknown) {
  const { Readable } = await import('stream');
  let status = 0;
  let out = '';
  const res = {
    writeHead: vi.fn((code: number) => { status = code; }),
    end: vi.fn((chunk: string) => { out = chunk; }),
  } as unknown as ServerResponse;
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    method, url, headers: { authorization: `Bearer ${ADMIN_TOKEN}`, 'content-type': 'application/json' },
  }) as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL(url, 'http://localhost'));
  return { status, body: JSON.parse(out) };
}

describe('vault routes', () => {
  beforeEach(() => {
    service = makeService();
    indexing = makeIndexing();
    reconcile = vi.fn();
    const controller = new VaultController(service as unknown as VaultService, indexing as unknown as VaultIndexingService, reconcile as never);
    router = new Router(createVaultRoutes(controller), ADMIN_TOKEN);
  });

  it('GET /files passes parsed filters and caps the limit', async () => {
    const { status, body } = await call('GET', '/api/vault/files?folder=lab&q=req&indexed=true&limit=5000&offset=3');
    expect(status).toBe(200);
    expect(service.searchFiles).toHaveBeenCalledWith({ folder: 'lab', text: 'req', indexed: true, limit: 1000, offset: 3 });
    expect(body).toEqual({ files: [], total: 0, limit: 1000, offset: 3 });
  });

  it('GET /manifest returns the legacy keyed shape', async () => {
    service.searchFiles.mockResolvedValue({ items: [{ filePath: 'a.md', hash: 'h', chunkIds: [], indexed: true, updatedAt: 't', content: 'x' }], total: 1 });
    const { body } = await call('GET', '/api/vault/manifest');
    expect(body).toEqual({ files: { 'a.md': { hash: 'h', chunkIds: [], indexed: true, updatedAt: 't' } }, total: 1 });
  });

  it('routes /files/:path/chunks before /files/:path and decodes nested paths', async () => {
    service.getFileChunks.mockResolvedValue({ total: 1, chunks: [{ id: 'c', index: 0, indexed: false }] });
    const { status, body } = await call('GET', '/api/vault/files/lab%2Fa.md/chunks?limit=500');
    expect(status).toBe(200);
    expect(service.getFileChunks).toHaveBeenCalledWith('lab/a.md', { limit: 100, offset: 0 });
    expect(body.file).toBe('lab/a.md');
  });

  it('GET /chunks?file= behaves like the per-file chunks route', async () => {
    const { status, body } = await call('GET', '/api/vault/chunks?file=missing.md');
    expect(status).toBe(404);
    expect(body).toEqual({ error: 'File not found' });
  });

  it('DELETE /files/:path returns 200 when clean, 202 when cleanup is pending, 404 when missing', async () => {
    service.deleteFile.mockResolvedValueOnce({ deleted: 1, pending: 0, vectors: VectorSyncResult.OK });
    expect(await call('DELETE', '/api/vault/files/a.md')).toEqual({ status: 200, body: { ok: true, deleted: 1, pending: 0, pinecone: 'ok' } });
    service.deleteFile.mockResolvedValueOnce({ deleted: 1, pending: 1, vectors: VectorSyncResult.PARTIAL });
    expect(await call('DELETE', '/api/vault/files/a.md')).toEqual({ status: 202, body: { ok: true, deleted: 1, pending: 1, pinecone: 'partial' } });
    expect((await call('DELETE', '/api/vault/files/missing.md')).status).toBe(404);
  });

  it('DELETE /files?folder= deletes a folder, 404 when empty', async () => {
    service.deleteFolder.mockResolvedValueOnce({ deleted: 2, pending: 0, vectors: VectorSyncResult.OK });
    expect(await call('DELETE', '/api/vault/files?folder=f')).toEqual({ status: 200, body: { ok: true, deleted: 2, pending: 0, pinecone: 'ok' } });
    expect((await call('DELETE', '/api/vault/files?folder=none')).status).toBe(404);
  });

  it('POST /files/:path/rename renames (validated body)', async () => {
    service.renameFile.mockResolvedValueOnce({ filePath: 'b.md' });
    const req = makeJsonCall('POST', '/api/vault/files/a.md/rename', { newPath: 'b.md' });
    expect(await req).toEqual({ status: 200, body: { ok: true, file: { filePath: 'b.md' } } });
    expect(service.renameFile).toHaveBeenCalledWith('a.md', 'b.md');
  });

  it('DELETE /files without a folder requires X-Confirm', async () => {
    expect((await call('DELETE', '/api/vault/files')).status).toBe(400);
    expect(service.deleteAll).not.toHaveBeenCalled();
    expect((await call('DELETE', '/api/vault/files', { 'x-confirm': 'delete-all' })).status).toBe(200);
    expect(service.deleteAll).toHaveBeenCalled();
  });

  it('maps reindex outcomes to 202 / 409 / 400', async () => {
    expect((await call('POST', '/api/vault/reindex')).status).toBe(202);
    indexing.requestManualReindex.mockReturnValueOnce(ReindexOutcome.ALREADY_RUNNING);
    expect(await call('POST', '/api/vault/reindex')).toEqual({ status: 409, body: { error: 'already indexing', retryAfter: 2 } });
    indexing.requestManualReindex.mockReturnValueOnce(ReindexOutcome.NOT_CONFIGURED);
    expect((await call('POST', '/api/vault/reindex')).status).toBe(400);
  });

  it('POST /sync and the legacy /sync-pinecone run the reconciler', async () => {
    reconcile.mockResolvedValueOnce({ deletesResumed: 1 });
    expect(await call('POST', '/api/vault/sync')).toEqual({ status: 200, body: { ok: true, result: { deletesResumed: 1 } } });
    reconcile.mockResolvedValueOnce({ deletesResumed: 0 });
    expect((await call('POST', '/api/vault/sync-pinecone')).status).toBe(200);
    reconcile.mockRejectedValueOnce(new ValidationError('bad'));
    expect((await call('POST', '/api/vault/sync')).status).toBe(400);
  });

  it('rejects writes with a wrong token but allows reads', async () => {
    const wrong = { authorization: 'Bearer nope' };
    expect((await call('DELETE', '/api/vault/files/a.md', wrong)).status).toBe(401);
    expect(service.deleteFile).not.toHaveBeenCalled();
    expect((await call('GET', '/api/vault/folders', wrong)).status).toBe(200);
  });

  it('returns 405 for a known path with the wrong method and 404 for unknown paths', async () => {
    expect((await call('POST', '/api/vault/folders')).status).toBe(405);
    expect((await call('GET', '/api/vault/unknown')).status).toBe(404);
  });

  it('turns handler errors into 500', async () => {
    service.listFolders.mockRejectedValueOnce(new Error('db down'));
    expect(await call('GET', '/api/vault/folders')).toEqual({ status: 500, body: { error: 'db down' } });
  });
});
