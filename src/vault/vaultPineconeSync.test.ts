import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeleteByIds = vi.fn().mockResolvedValue(undefined);
const mockDeleteAll = vi.fn().mockResolvedValue(undefined);
vi.mock('../rag/vectorStore', () => ({
  VectorStore: vi.fn(function(this: any) {
    this.deleteByIds = mockDeleteByIds;
    this.deleteAll = mockDeleteAll;
    return this;
  }),
}));

import { syncDeleteFile, syncDeleteAll, reconcileOrphans } from './vaultPineconeSync';

const cfg: any = { pineconeApiKey: 'pk', pineconeIndex: 'idx', embeddingProvider: 'openai' };

beforeEach(() => { mockDeleteByIds.mockClear(); mockDeleteAll.mockClear(); });

describe('vaultPineconeSync', () => {
  it('syncDeleteFile skips when chunkIds empty', async () => {
    const r = await syncDeleteFile({ filePath: 'a.md', chunkIds: [], hash: 'h', indexed: false, updatedAt: '', content: '' } as any, cfg);
    expect(r).toBe('skip');
    expect(mockDeleteByIds).not.toHaveBeenCalled();
  });

  it('syncDeleteFile calls deleteByIds with correct ids', async () => {
    const r = await syncDeleteFile({ filePath: 'a.md', chunkIds: ['c1','c2'], hash: 'h', indexed: true, updatedAt: '', content: '' } as any, cfg);
    expect(r).toBe('ok');
    expect(mockDeleteByIds).toHaveBeenCalledWith(['c1','c2']);
  });

  it('syncDeleteFile returns partial on error', async () => {
    mockDeleteByIds.mockRejectedValueOnce(new Error('boom'));
    const r = await syncDeleteFile({ filePath: 'a.md', chunkIds: ['c1'], hash: 'h', indexed: true, updatedAt: '', content: '' } as any, cfg);
    expect(r).toBe('partial');
  });

  it('syncDeleteAll calls deleteAll', async () => {
    await syncDeleteAll(cfg);
    expect(mockDeleteAll).toHaveBeenCalled();
  });

  it('reconcileOrphans deletes all when Neon empty', async () => {
    const storage: any = { list: vi.fn().mockResolvedValue({ entries: [], total: 0 }) };
    const n = await reconcileOrphans(storage, cfg);
    expect(n).toBe(-1);
    expect(mockDeleteAll).toHaveBeenCalled();
  });

  it('reconcileOrphans no-op when Neon non-empty', async () => {
    const storage: any = { list: vi.fn().mockResolvedValue({ entries: [{ filePath: 'a.md', chunkIds: ['c1'] }], total: 1 }) };
    mockDeleteAll.mockClear();
    const n = await reconcileOrphans(storage, cfg);
    expect(n).toBe(0);
    expect(mockDeleteAll).not.toHaveBeenCalled();
  });
});
