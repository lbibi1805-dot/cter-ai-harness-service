import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIndexAll = vi.fn().mockResolvedValue(undefined);
vi.mock('../rag/knowledgeIndexer', () => ({
  KnowledgeIndexer: vi.fn(function(this: any) { this.indexAll = mockIndexAll; return this; }),
}));
vi.mock('../rag/embeddingService', () => ({
  createEmbeddingService: vi.fn(() => ({ dimension: 1536 })),
}));

import { ApiServer } from './server';

function makeConfig(): any {
  return {
    accounts: [{ url: 'https://x.instructure.com', apiKey: 'k', index: 1 }],
    aiKeys: { openai: 'sk', gemini: 'gk' },
    defaultModels: {}, modelFallback: {},
    pollIntervalMs: 60000, maxRetryCount: 3, systemPrompt: '', knowledgeContent: '',
    grokBaseUrl: '', aiTimeoutMs: 120000, gmail: { user: '', appPassword: '' },
    vaultConfig: { pineconeApiKey: 'pk', pineconeIndex: 'idx', embeddingProvider: 'openai' as const, vaultPath: './documents-vault', topK: 6, embeddingBatchSize: 1, embeddingDelayMs: 0 },
    canvasFolder: { materials: 'm', input: 'i', output: 'o' },
  };
}

describe('vault auto-index', () => {
  beforeEach(() => { mockIndexAll.mockClear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('POST /reindex triggers background index and returns 202', async () => {
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    const req: any = { method: 'POST', url: '/api/vault/reindex', headers: { host: 'localhost', authorization: '' } };
    const res: any = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
    await (server as any).handleVault(req, res, '/api/vault/reindex', {});
    expect(res.writeHead).toHaveBeenCalledWith(202, expect.any(Object));
    // allow setImmediate to run
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockIndexAll).toHaveBeenCalled();
  });

  it('POST /reindex returns 409 when already indexing', async () => {
    const server = new ApiServer(async () => {}, makeConfig(), { sendMail: vi.fn() } as any, 0);
    (server as any).isIndexing = true;
    const req: any = { method: 'POST', url: '/api/vault/reindex', headers: { host: 'localhost' } };
    const res: any = { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() };
    await (server as any).handleVault(req, res, '/api/vault/reindex', {});
    expect(res.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
  });
});
