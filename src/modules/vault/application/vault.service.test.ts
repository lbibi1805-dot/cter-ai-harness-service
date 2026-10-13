import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileVaultRepository } from '../infrastructure/fileVault.repository';
import { VectorSyncResult, type VaultDocumentStore, type VectorIndex } from '../domain';
import { RECONCILE_ALL_VECTORS_DELETED, VaultService } from './vault.service';

let rootDir: string;
let repo: FileVaultRepository;

function fakeVectors(): VectorIndex & { deleteByIds: ReturnType<typeof vi.fn>; deleteAll: ReturnType<typeof vi.fn>; fetchMetadata: ReturnType<typeof vi.fn> } {
  return {
    deleteByIds: vi.fn().mockResolvedValue(undefined),
    deleteAll: vi.fn().mockResolvedValue(undefined),
    fetchMetadata: vi.fn().mockResolvedValue({}),
  };
}

function fakeDocuments(): VaultDocumentStore & { write: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } {
  return { write: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined) };
}

async function seed(filePath: string, chunkIds: string[], indexed = true) {
  await repo.save({ filePath, hash: 'h', chunkIds, indexed, content: 'c' });
}

describe('VaultService', () => {
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-svc-'));
    repo = new FileVaultRepository(rootDir);
  });
  afterEach(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  describe('deleteFile', () => {
    it('removes vectors, manifest entry and disk copy', async () => {
      await seed('a.md', ['c1', 'c2']);
      const vectors = fakeVectors();
      const documents = fakeDocuments();
      const result = await new VaultService(repo, vectors, documents).deleteFile('a.md');
      expect(result).toBe(VectorSyncResult.OK);
      expect(vectors.deleteByIds).toHaveBeenCalledWith(['c1', 'c2']);
      expect(await repo.findByPath('a.md')).toBeNull();
      expect(documents.remove).toHaveBeenCalledWith(['a.md']);
    });

    it('returns null for an unknown file', async () => {
      expect(await new VaultService(repo, fakeVectors(), fakeDocuments()).deleteFile('nope.md')).toBeNull();
    });

    it('skips vectors when the file has no chunks or no index is configured', async () => {
      await seed('empty.md', []);
      await seed('b.md', ['c1']);
      expect(await new VaultService(repo, fakeVectors(), fakeDocuments()).deleteFile('empty.md')).toBe(VectorSyncResult.SKIP);
      expect(await new VaultService(repo, null, fakeDocuments()).deleteFile('b.md')).toBe(VectorSyncResult.SKIP);
    });

    it('still deletes the entry when the vector delete fails', async () => {
      await seed('a.md', ['c1']);
      const vectors = fakeVectors();
      vectors.deleteByIds.mockRejectedValue(new Error('boom'));
      expect(await new VaultService(repo, vectors, fakeDocuments()).deleteFile('a.md')).toBe(VectorSyncResult.PARTIAL);
      expect(await repo.findByPath('a.md')).toBeNull();
    });
  });

  it('deleteFolder removes every file under the folder only', async () => {
    await seed('f/a.md', ['c1']);
    await seed('f/sub/b.md', ['c2']);
    await seed('fx/c.md', ['c3']);
    const vectors = fakeVectors();
    const service = new VaultService(repo, vectors, fakeDocuments());
    expect(await service.deleteFolder('f')).toBe(2);
    expect(vectors.deleteByIds).toHaveBeenCalledWith(['c1', 'c2']);
    expect((await repo.findAll()).map((e) => e.filePath)).toEqual(['fx/c.md']);
    expect(await service.deleteFolder('missing')).toBe(0);
  });

  it('deleteAll clears vectors and manifest even if the vector clear fails', async () => {
    await seed('a.md', ['c1']);
    await seed('b.md', ['c2']);
    const vectors = fakeVectors();
    vectors.deleteAll.mockRejectedValue(new Error('down'));
    expect(await new VaultService(repo, vectors, fakeDocuments()).deleteAll()).toBe(2);
    expect(await repo.findAll()).toEqual([]);
  });

  it('uploadFiles sanitizes paths, stores normalized content and rejects long paths', async () => {
    const documents = fakeDocuments();
    const results = await new VaultService(repo, null, documents).uploadFiles([
      { rawName: '..\\lab\\notes.txt', content: 'hello' },
      { rawName: `${'a'.repeat(1100)}.md`, content: 'x' },
    ]);
    expect(results[0]).toMatchObject({ file: 'lab/notes.md', indexed: false });
    expect(results[1]).toMatchObject({ error: 'path too long' });
    expect(documents.write).toHaveBeenCalledTimes(1);
    expect(await repo.findByPath('lab/notes.md')).toMatchObject({ indexed: false, chunkIds: [], content: 'hello' });
  });

  it('getFileChunks pages ids and enriches indexed files with vector metadata', async () => {
    await seed('a.md', ['c0', 'c1', 'c2']);
    const vectors = fakeVectors();
    vectors.fetchMetadata.mockResolvedValue({ c1: { text: 't1', source: 'a.md', heading: 'H', parentHeading: '', tokenCount: 3 } });
    const result = await new VaultService(repo, vectors, fakeDocuments()).getFileChunks('a.md', { limit: 2, offset: 1 });
    expect(result!.total).toBe(3);
    expect(result!.chunks).toEqual([
      { id: 'c1', index: 1, indexed: true, text: 't1', source: 'a.md', heading: 'H', parentHeading: '', tokenCount: 3 },
      { id: 'c2', index: 2, indexed: true },
    ]);
  });

  describe('reconcileVectors', () => {
    it('clears the vector index when the manifest is empty', async () => {
      const vectors = fakeVectors();
      expect(await new VaultService(repo, vectors, fakeDocuments()).reconcileVectors()).toBe(RECONCILE_ALL_VECTORS_DELETED);
      expect(vectors.deleteAll).toHaveBeenCalled();
    });

    it('does nothing when the manifest has entries', async () => {
      await seed('a.md', ['c1']);
      const vectors = fakeVectors();
      expect(await new VaultService(repo, vectors, fakeDocuments()).reconcileVectors()).toBe(0);
      expect(vectors.deleteAll).not.toHaveBeenCalled();
    });
  });
});
