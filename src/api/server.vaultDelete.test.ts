import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSyncDeleteFile = vi.fn().mockResolvedValue('ok');
const mockSyncDeleteAll = vi.fn().mockResolvedValue(undefined);
const mockReconcile = vi.fn().mockResolvedValue(0);
vi.mock('../vault/vaultPineconeSync', () => ({
  syncDeleteFile: (...a: any[]) => mockSyncDeleteFile(...a),
  syncDeleteAll: (...a: any[]) => mockSyncDeleteAll(...a),
  reconcileOrphans: (...a: any[]) => mockReconcile(...a),
}));

const mockStorage: any = {
  get: vi.fn(),
  list: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};
vi.mock('../vault', () => ({
  createVaultStorageWithFallback: vi.fn(async () => mockStorage),
}));

import { ApiServer } from './server';
import type { AppConfig } from '../types';

function makeConfig(): AppConfig {
  return {
    accounts: [{ url: 'https://x.instructure.com', apiKey: 'k', index: 1 }],
    aiKeys: {},
    defaultModels: { claude: 'c', gemini: 'g', grok: 'g', openai: 'o' } as any,
    modelFallback: { claude: [], gemini: [], grok: [], openai: [] } as any,
    pollIntervalMs: 60000,
    maxRetryCount: 3,
    systemPrompt: '',
    knowledgeContent: '',
    grokBaseUrl: '',
    aiTimeoutMs: 120000,
    gmail: { user: '', appPassword: '' },
    vaultConfig: { pineconeApiKey: 'pk', pineconeIndex: 'idx', embeddingProvider: 'openai' as const, vaultPath: './documents-vault', topK: 6, embeddingBatchSize: 1, embeddingDelayMs: 0 },
    canvasFolder: { materials: 'm', input: 'i', output: 'o' },
  } as any;
}

function mockRes() {
  let status = 0; let body = '';
  const res: any = {
    writeHead: vi.fn((c: number) => { status = c; }),
    end: vi.fn((b: string) => { body = b; }),
    setHeader: vi.fn(),
    get status() { return status; },
    get body() { try { return JSON.parse(body); } catch { return body; } },
  };
  return res;
}

describe('server vault delete auto pinecone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.get.mockReset();
    mockStorage.list.mockReset();
    mockStorage.remove.mockReset();
    mockStorage.clear.mockReset();
    mockStorage.list.mockResolvedValue({ entries: [], total: 0 });
  });

  it('DELETE /files/:path calls syncDeleteFile and removes Neon', async () => {
    const entry = { filePath: 'a.md', chunkIds: ['c1'], hash: 'h', indexed: true, content: 'x', updatedAt: '' };
    mockStorage.get.mockResolvedValue(entry);
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req: any = { method: 'DELETE', url: '/api/vault/files/a.md', headers: { host: 'localhost', authorization: '' } };
    const res = mockRes();
    const u = new URL(req.url, 'http://localhost');
    await (server as any).handleVault(req, res, u.pathname, Object.fromEntries(u.searchParams.entries()));
    expect(res.status).toBe(200);
    expect(mockSyncDeleteFile).toHaveBeenCalledWith(entry, expect.any(Object));
    expect(mockStorage.remove).toHaveBeenCalledWith('a.md');
    expect(res.body.pinecone).toBe('ok');
  });

  it('DELETE /files/:path 404 when not found', async () => {
    mockStorage.get.mockResolvedValue(null);
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req: any = { method: 'DELETE', url: '/api/vault/files/missing.md', headers: { host: 'localhost' } };
    const res = mockRes();
    const u = new URL(req.url, 'http://localhost');
    await (server as any).handleVault(req, res, u.pathname, Object.fromEntries(u.searchParams.entries()));
    expect(res.status).toBe(404);
  });

  it('DELETE /files?folder= deletes bulk', async () => {
    const entries = [{ filePath: 'f/a.md', chunkIds: ['c1'] }, { filePath: 'f/b.md', chunkIds: ['c2'] }];
    mockStorage.list.mockResolvedValue({ entries, total: 2 });
    // mock VectorStore for bulk folder delete
    vi.doMock('../rag/vectorStore', () => ({ VectorStore: vi.fn(function(this: any){ this.deleteByIds = vi.fn().mockResolvedValue(undefined); }) }));
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req: any = { method: 'DELETE', url: '/api/vault/files?folder=f', headers: { host: 'localhost' } };
    const res = mockRes();
    const u = new URL(req.url, 'http://localhost');
    await (server as any).handleVault(req, res, u.pathname, Object.fromEntries(u.searchParams.entries()));
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
  });

  it('DELETE /files clear all needs X-Confirm', async () => {
    mockStorage.list.mockResolvedValue({ entries: [], total: 0 });
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req1: any = { method: 'DELETE', url: '/api/vault/files', headers: { host: 'localhost' } };
    const res1 = mockRes();
    let u = new URL(req1.url, 'http://localhost');
    await (server as any).handleVault(req1, res1, u.pathname, Object.fromEntries(u.searchParams.entries()));
    expect(res1.status).toBe(400);
    const req2: any = { method: 'DELETE', url: '/api/vault/files', headers: { host: 'localhost', 'x-confirm': 'delete-all' } };
    const res2 = mockRes();
    u = new URL(req2.url, 'http://localhost');
    await (server as any).handleVault(req2, res2, u.pathname, Object.fromEntries(u.searchParams.entries()));
    expect(res2.status).toBe(200);
  });

  it('POST /sync-pinecone calls reconcile', async () => {
    mockStorage.list.mockResolvedValue({ entries: [], total: 0 });
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req: any = { method: 'POST', url: '/api/vault/sync-pinecone', headers: { host: 'localhost' } };
    const res = mockRes();
    await (server as any).handleVault(req, res, '/api/vault/sync-pinecone', {});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
