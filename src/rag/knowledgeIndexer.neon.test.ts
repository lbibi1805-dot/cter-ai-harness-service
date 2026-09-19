import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import { normalizeText } from './textNormalizer';
import type { VaultConfig } from '../types';
import type { IEmbeddingService } from './embeddingService';

vi.mock('../vault', () => ({
  createVaultStorageWithFallback: vi.fn(),
}));

function makeConfig(): VaultConfig {
  return {
    vaultPath: './documents-vault',
    pineconeApiKey: 'fake-key',
    pineconeIndex: 'test-index',
    embeddingProvider: 'openai' as const,
    topK: 6,
    embeddingBatchSize: 2,
    embeddingDelayMs: 0,
  };
}

function makeEmbedder(): IEmbeddingService & { embedBatch: ReturnType<typeof vi.fn> } {
  return {
    dimension: 1536,
    provider: 'openai',
    embed: vi.fn(async () => new Array(1536).fill(0.01)),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(() => new Array(1536).fill(0.01))),
  } as any;
}

function mockVectorStore() {
  return {
    ensureIndex: vi.fn().mockResolvedValue(undefined),
    deleteByIds: vi.fn().mockResolvedValue(undefined),
    upsertChunks: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function makeStorage(entries: any[]) {
  return {
    list: vi.fn().mockResolvedValue({ entries, total: entries.length }),
    get: vi.fn().mockImplementation(async (fp: string) => entries.find((e: any) => e.filePath === fp) ?? null),
    upsert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    stats: vi.fn().mockResolvedValue({ total: entries.length, indexed: entries.filter((e: any) => e.indexed).length }),
    init: vi.fn().mockResolvedValue(undefined),
    listFolders: vi.fn().mockResolvedValue([]),
  };
}

function md5(s: string) { return crypto.createHash('md5').update(normalizeText(s)).digest('hex'); }

describe('KnowledgeIndexer Neon-only', () => {
  beforeEach(() => vi.clearAllMocks());

  it('empty vault does not call embed', async () => {
    const storage = makeStorage([]);
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), makeEmbedder(), mockVectorStore());
    await indexer.indexAll();
    expect(storage.list).toHaveBeenCalled();
    expect(storage.upsert).not.toHaveBeenCalled();
  });

  it('skips files with empty content', async () => {
    const entries = [{ filePath: 'empty.md', hash: md5(''), chunkIds: [], indexed: false, content: '', updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    expect(embedder.embedBatch).not.toHaveBeenCalled();
    expect(vs.upsertChunks).not.toHaveBeenCalled();
  });

  it('skips already indexed files with matching hash', async () => {
    const content = '## Title\n\nbody here';
    const entries = [{ filePath: 'done.md', hash: md5(content), chunkIds: ['done_Title_chunk_000'], indexed: true, content, updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    expect(embedder.embedBatch).not.toHaveBeenCalled();
  });

  it('re-indexes when indexed=false', async () => {
    const content = '## Sec\n\nhello world';
    const entries = [{ filePath: 'pending.md', hash: md5(content), chunkIds: [], indexed: false, content, updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    expect(embedder.embedBatch).toHaveBeenCalled();
    expect(vs.upsertChunks).toHaveBeenCalled();
    const lastCall = storage.upsert.mock.calls.at(-1)![0];
    expect(lastCall.indexed).toBe(true);
    expect(lastCall.content).toBe(content);
  });

  it('re-indexes when hash mismatch vs normalized content', async () => {
    const content = '## Sec\n\nnew content';
    const oldHash = md5('old content');
    const entries = [{ filePath: 'changed.md', hash: oldHash, chunkIds: ['old_chunk'], indexed: true, content, updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    expect(vs.deleteByIds).toHaveBeenCalledWith(['old_chunk']);
    expect(embedder.embedBatch).toHaveBeenCalled();
  });

  it('marks indexed=false when embedding fails', async () => {
    const content = '## Fail\n\ntext';
    const entries = [{ filePath: 'fail.md', hash: md5(content), chunkIds: [], indexed: false, content, updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    embedder.embedBatch = vi.fn().mockRejectedValue(new Error('invalid api key'));
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    const lastCall = storage.upsert.mock.calls.at(-1)![0];
    expect(lastCall.indexed).toBe(false);
    expect(vs.upsertChunks).not.toHaveBeenCalled();
  });

  it('upsert stores normalized content hash', async () => {
    const raw = '## Title\r\n\nbody\u00A0with nbsp';
    const normalized = normalizeText(raw);
    const entries = [{ filePath: 'norm.md', hash: 'wrong', chunkIds: [], indexed: true, content: raw, updatedAt: new Date().toISOString() }];
    const storage = makeStorage(entries);
    const vs = mockVectorStore();
    const embedder = makeEmbedder();
    const { createVaultStorageWithFallback } = await import('../vault');
    vi.mocked(createVaultStorageWithFallback).mockResolvedValue(storage as any);
    const { KnowledgeIndexer } = await import('./knowledgeIndexer');
    const indexer = new KnowledgeIndexer(makeConfig(), embedder, vs);
    await indexer.indexAll();
    const firstUpsert = storage.upsert.mock.calls[0]![0];
    expect(firstUpsert.hash).toBe(md5(normalized));
  });
});
