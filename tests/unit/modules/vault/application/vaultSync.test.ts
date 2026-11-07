import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeIndexer } from '../../../../../src/modules/retrieval/application/knowledgeIndexer.service';
import { EmbeddingProvider } from '../../../../../src/modules/retrieval';
import { VaultService } from '../../../../../src/modules/vault/application/vault.service';
import { createVaultChunkGuard } from '../../../../../src/modules/vault/application/vaultChunkGuard';
import { CachedVaultRepository } from '../../../../../src/modules/vault/infrastructure/cachedVault.repository';
import { InMemoryVaultRepository } from '../../../../../src/modules/vault/infrastructure/inMemoryVault.repository';
import {
  VaultEntryStatus,
  VaultUploadOutcome,
  VectorSyncResult,
  computeContentHash,
  parseChunkId,
  vaultObjectKey,
  type VaultEntry,
} from '../../../../../src/modules/vault/domain';
import { FakeEmbedder, FakeObjectStorage, FakeVectorStore, flaky, vectorIndexOf } from '../../../../support/countingAdapters';

const GRACE_MS = 1_000;

function makeVault() {
  let clock = 1_000_000;
  const now = () => clock;
  const inner = flaky(new InMemoryVaultRepository());
  const repo = new CachedVaultRepository(inner.proxy);
  const storage = new FakeObjectStorage(now);
  const vectors = new FakeVectorStore();
  const embedder = new FakeEmbedder();
  let scheduled = 0;
  const service = new VaultService(repo, vectorIndexOf(vectors), storage, { scheduleAfterUpload: () => { scheduled++; } }, { now, orphanGraceMs: GRACE_MS });
  const index = () => new KnowledgeIndexer(
    { embeddingProvider: EmbeddingProvider.GEMINI, embeddingBatchSize: 10, embeddingDelayMs: 0 },
    embedder, repo, vectors, service.documents, async () => undefined,
  ).indexAll();
  const upload = async (name: string, content: string) => (await service.uploadFiles([{ rawName: name, content }]))[0];
  const guard = createVaultChunkGuard(repo);
  return {
    repo, inner, storage, vectors, embedder, service, index, upload, guard,
    advance: (ms: number) => { clock += ms; },
    scheduled: () => scheduled,
  };
}

async function entry(v: ReturnType<typeof makeVault>, path: string): Promise<VaultEntry> {
  const e = await v.repo.findByPath(path);
  if (!e) throw new Error(`no entry ${path}`);
  return e;
}

async function guardedSources(v: ReturnType<typeof makeVault>): Promise<string[]> {
  return v.guard(await v.vectors.query([], 1000)).map((c) => `${c.source}|${c.text}`);
}

describe('vault sync: upload → object storage → index (notes 02 + 12)', () => {
  let v: ReturnType<typeof makeVault>;
  beforeEach(() => { v = makeVault(); });

  it('stores the file content-addressed, then indexes it with <docId>#<hash8>#<idx> ids', async () => {
    const result = await v.upload('mon/a.md', '## Mutex\nOwner unlocks.');
    expect(result).toMatchObject({ file: 'mon/a.md', indexed: false, outcome: VaultUploadOutcome.CREATED });

    const e = await entry(v, 'mon/a.md');
    expect(e.status).toBe(VaultEntryStatus.INDEXING);
    expect(e.objectKey).toBe(vaultObjectKey(e.docId, e.hash));
    expect(v.storage.keys('vault/')).toEqual([e.objectKey]);
    expect(v.storage.objects.get(e.objectKey)!.metadata.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(v.scheduled()).toBe(1);

    expect(await v.index()).toEqual({ indexed: 1, failed: 0 });
    const done = await entry(v, 'mon/a.md');
    expect(done).toMatchObject({ status: VaultEntryStatus.ACTIVE, indexed: true, indexedHash: e.hash });
    expect(done.chunkIds).toEqual([`${e.docId}#${e.hash.slice(0, 8)}#000`]);
    expect(v.vectors.ids()).toEqual(done.chunkIds);
    expect(v.vectors.records.get(done.chunkIds[0])).toMatchObject({ docId: e.docId, contentHash: e.hash, source: 'mon/a.md' });
  });

  it('an empty file gets a per-file error; the other files of the batch are stored', async () => {
    const results = await v.service.uploadFiles([
      { rawName: 'e/a.md', content: '## A\nx' },
      { rawName: 'e/empty.md', content: '  \n' },
    ]);
    expect(results[0]).toMatchObject({ file: 'e/a.md', outcome: 'created' });
    expect(results[1]).toEqual({ file: 'e/empty.md', error: 'empty file' });
    expect(await v.repo.findByPath('e/empty.md')).toBeNull();
  });

  it('I4: re-uploading identical content does no object put and no embedding (bug fix)', async () => {
    await v.upload('a.md', '## A\nsame');
    await v.index();
    const puts = v.storage.faults.count('put');
    const embedded = v.embedder.embedded;

    const again = await v.upload('a.md', '## A\nsame\n');   // trailing whitespace normalizes to the same hash
    expect(again).toMatchObject({ outcome: VaultUploadOutcome.UNCHANGED, indexed: true });
    expect(v.storage.faults.count('put')).toBe(puts);
    expect(await v.index()).toEqual({ indexed: 0, failed: 0 });
    expect(v.embedder.embedded).toBe(embedded);
  });

  it('editing one file re-embeds only that file and swaps object + vectors (new first, old last)', async () => {
    await v.upload('a.md', '## A\nv1');
    await v.upload('b.md', '## B\nother');
    await v.index();
    const before = await entry(v, 'a.md');
    const embedded = v.embedder.embedded;

    const edited = await v.upload('a.md', '## A\nv2');
    expect(edited).toMatchObject({ outcome: VaultUploadOutcome.UPDATED });
    const pending = await entry(v, 'a.md');
    expect(pending.docId).toBe(before.docId);
    expect(v.storage.objects.has(before.objectKey)).toBe(false);          // old object dropped once unreferenced
    expect(await guardedSources(v)).toContain('a.md|v1');                 // old version still searchable meanwhile

    await v.index();
    expect(v.embedder.embedded - embedded).toBe(1);                         // only a.md
    const after = await entry(v, 'a.md');
    expect(v.vectors.ids(before.docId)).toEqual(after.chunkIds);
    expect(await guardedSources(v)).toEqual(expect.arrayContaining(['a.md|v2', 'b.md|other']));
    expect(await guardedSources(v)).not.toContain('a.md|v1');
  });

  it('a failed embedding marks the file failed and keeps the previous version live', async () => {
    await v.upload('a.md', '## A\nv1');
    await v.index();
    await v.upload('a.md', '## A\nv2');
    v.embedder.failNext();
    expect(await v.index()).toEqual({ indexed: 0, failed: 1 });
    const e = await entry(v, 'a.md');
    expect(e.status).toBe(VaultEntryStatus.FAILED);
    expect(e.lastError).toMatch(/embedding failed/);
    expect(await guardedSources(v)).toEqual(['a.md|v1']);

    expect(await v.index()).toEqual({ indexed: 1, failed: 0 });            // retry succeeds
    expect(await guardedSources(v)).toEqual(['a.md|v2']);
  });

  it('a file edited while it is being indexed: the stale vectors are dropped, never committed', async () => {
    await v.upload('a.md', '## A\nv1');
    v.embedder.beforeEmbed = async () => { await v.upload('a.md', '## A\nv2'); };
    await v.index();
    const e = await entry(v, 'a.md');
    expect(e.indexed).toBe(false);
    expect(v.vectors.ids()).toEqual([]);                                    // v1 vectors deleted right away
    await v.index();
    expect(await guardedSources(v)).toEqual(['a.md|v2']);
  });

  it('rename changes only the manifest: 0 object puts, 0 embeddings, RAG cites the new path', async () => {
    await v.upload('old/a.md', '## A\ntext');
    await v.index();
    const puts = v.storage.faults.count('put');
    const embedded = v.embedder.embedded;

    const renamed = await v.service.renameFile('old/a.md', 'new/b');
    expect(renamed.filePath).toBe('new/b.md');
    expect(v.storage.faults.count('put')).toBe(puts);
    expect(await v.index()).toEqual({ indexed: 0, failed: 0 });
    expect(v.embedder.embedded).toBe(embedded);
    expect(await guardedSources(v)).toEqual(['new/b.md|text']);
    expect(await v.repo.findByPath('old/a.md')).toBeNull();
  });

  it('I6: Vietnamese names that used to collide get distinct ids; deleting one keeps the other', async () => {
    await v.upload('Bài 1.md', '## Giới thiệu\nnội dung A');
    await v.upload('Bái 1.md', '## Giới thiệu\nnội dung B');
    await v.index();
    const a = await entry(v, 'Bài 1.md');
    const b = await entry(v, 'Bái 1.md');
    expect(new Set([...a.chunkIds, ...b.chunkIds]).size).toBe(a.chunkIds.length + b.chunkIds.length);

    await v.service.deleteFile('Bài 1.md');
    expect(v.vectors.ids()).toEqual(b.chunkIds);
    expect(await guardedSources(v)).toEqual(['Bái 1.md|nội dung B']);
  });
});

describe('vault sync: deletes are a committed state finished idempotently', () => {
  let v: ReturnType<typeof makeVault>;
  beforeEach(() => { v = makeVault(); });

  it('deletes vectors (by prefix), objects (by prefix) and finally the row', async () => {
    await v.upload('a.md', '## A\nx');
    await v.index();
    const e = await entry(v, 'a.md');
    v.vectors.records.set(`${e.docId}#deadbeef#000`, { ...v.vectors.records.get(e.chunkIds[0])!, id: `${e.docId}#deadbeef#000` }); // stray old vector

    expect(await v.service.deleteFile('a.md')).toEqual({ deleted: 1, pending: 0, vectors: VectorSyncResult.OK });
    expect(v.vectors.ids()).toEqual([]);
    expect(v.storage.keys()).toEqual([]);
    expect(await v.repo.findByPath('a.md')).toBeNull();
  });

  it('a vector-store outage leaves the row `deleting`: hidden everywhere, RAG never shows it, reconcile finishes', async () => {
    await v.upload('a.md', '## A\nsecret');
    await v.upload('b.md', '## B\nkept');
    await v.index();
    v.vectors.faults.failNext('deleteByIds');

    expect(await v.service.deleteFile('a.md')).toEqual({ deleted: 1, pending: 1, vectors: VectorSyncResult.PARTIAL });
    expect((await v.repo.findByPath('a.md'))?.status).toBe(VaultEntryStatus.DELETING);
    expect((await v.service.searchFiles({ limit: 10, offset: 0 })).items.map((i) => i.filePath)).toEqual(['b.md']);
    expect(await v.service.stats()).toEqual({ total: 1, indexed: 1 });
    expect(await guardedSources(v)).toEqual(['b.md|kept']);                 // read-side guard
    await expect(v.service.getFile('a.md')).rejects.toThrow('Not found');

    const report = await v.service.reconcile();
    expect(report).toMatchObject({ deletesResumed: 1, deletesStillPending: 0 });
    expect(await v.repo.findByPath('a.md')).toBeNull();
    expect(v.vectors.ids().every((id) => !id.startsWith((report as never as { x: string }).x ?? '$'))).toBe(true);
    expect(await guardedSources(v)).toEqual(['b.md|kept']);
    expect(v.storage.keys('vault/').length).toBe(1);
  });

  it('re-uploading a path whose delete is pending finishes the delete first, then stores a new document', async () => {
    await v.upload('a.md', '## A\nold');
    await v.index();
    const old = await entry(v, 'a.md');
    v.storage.faults.failNext('deletePrefix');
    expect((await v.service.deleteFile('a.md')).pending).toBe(1);

    const again = await v.upload('a.md', '## A\nnew');
    expect(again).toMatchObject({ outcome: VaultUploadOutcome.CREATED });
    const fresh = await entry(v, 'a.md');
    expect(fresh.docId).not.toBe(old.docId);
    expect(v.storage.keys(`vault/${old.docId}/`)).toEqual([]);
  });

  it('deleteFolder marks every file in one update and purges them; deleteAll clears by prefix', async () => {
    await v.upload('f/a.md', '## A\n1');
    await v.upload('f/sub/b.md', '## B\n2');
    await v.upload('g/c.md', '## C\n3');
    await v.index();

    expect(await v.service.deleteFolder('f')).toMatchObject({ deleted: 2, pending: 0 });
    expect((await v.service.searchFiles({ limit: 10, offset: 0 })).items.map((i) => i.filePath)).toEqual(['g/c.md']);
    await expect(v.service.deleteFolder('f')).rejects.toThrow('Folder not found');

    expect(await v.service.deleteAll()).toMatchObject({ deleted: 1, pending: 0 });
    expect(v.vectors.ids()).toEqual([]);
    expect(v.storage.keys()).toEqual([]);
    expect(await v.service.stats()).toEqual({ total: 0, indexed: 0 });
  });
});

describe('vault sync: crashes leave garbage, never dangling pointers', () => {
  let v: ReturnType<typeof makeVault>;
  beforeEach(() => { v = makeVault(); });

  it('object put fails → the upload reports an error, nothing changes', async () => {
    v.storage.faults.failNext('put');
    const r = await v.upload('a.md', '## A\nx');
    expect(r).toMatchObject({ file: 'a.md', error: expect.stringMatching(/injected put/) });
    expect(await v.repo.findByPath('a.md')).toBeNull();
  });

  it('manifest write fails after the put → orphan object only; reconcile removes it after the grace period', async () => {
    v.inner.failNext('saveVersion');
    const r = await v.upload('a.md', '## A\nx');
    expect(r).toHaveProperty('error');
    expect(v.storage.keys('vault/')).toHaveLength(1);

    await v.service.reconcile();
    expect(v.storage.keys('vault/')).toHaveLength(1);                      // younger than the grace period: kept
    v.advance(GRACE_MS + 1);
    expect((await v.service.reconcile()).orphanObjectsDeleted).toBe(1);
    expect(v.storage.keys()).toEqual([]);
  });

  it('commit fails after upsert → new vectors are orphans, filtered by the guard, removed by reconcile', async () => {
    await v.upload('a.md', '## A\nv1');
    await v.index();
    await v.upload('a.md', '## A\nv2');
    v.inner.failNext('commitIndexed');
    expect(await v.index()).toEqual({ indexed: 0, failed: 1 });
    expect(v.vectors.ids()).toHaveLength(2);
    expect(await guardedSources(v)).toEqual(['a.md|v1']);

    expect((await v.service.reconcile()).orphanVectorsDeleted).toBe(1);
    expect(await v.index()).toEqual({ indexed: 1, failed: 0 });
    expect(await guardedSources(v)).toEqual(['a.md|v2']);
  });

  it('a stored object whose sha256 does not match is treated as missing (integrity)', async () => {
    await v.upload('a.md', '## A\nx');
    const e = await entry(v, 'a.md');
    v.storage.objects.get(e.objectKey)!.body = Buffer.from('tampered');
    expect(await v.service.readContent(e)).toBeNull();
    expect(await v.index()).toEqual({ indexed: 0, failed: 1 });
    expect((await entry(v, 'a.md')).lastError).toMatch(/object missing/);
  });

  it('reconcile removes vectors and derived objects nothing points to, and reports legacy rows', async () => {
    await v.upload('a.md', '## A\nx');
    await v.index();
    v.vectors.records.set('legacy_chunk_000', { id: 'legacy_chunk_000', text: 't', source: 'gone.md', heading: '', parentHeading: '', tokenCount: 1, vector: [1] });
    await v.storage.put('derived/00000000-0000-4000-8000-000000000000/x/extracted.md', 'x', { contentType: 'text/markdown' });
    v.advance(GRACE_MS + 1);

    const report = await v.service.reconcile();
    expect(report).toMatchObject({ orphanVectorsDeleted: 1, orphanObjectsDeleted: 1, pendingIndex: 0, legacyRows: 0 });
    expect(v.vectors.ids().every((id) => parseChunkId(id) !== null)).toBe(true);
  });

  it('hash is md5 of normalized content (not the R2 ETag)', async () => {
    const r = await v.upload('a.md', '## A\r\nx  ');
    expect(r).toMatchObject({ hash: computeContentHash('## A\nx') });
  });
});
