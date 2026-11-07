import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as crypto from 'crypto';
import { KnowledgeIndexer } from '../../../../../src/modules/retrieval/application/knowledgeIndexer.service';
import { EmbeddingProvider } from '../../../../../src/modules/retrieval';
import { VaultService } from '../../../../../src/modules/vault/application/vault.service';
import { createVaultChunkGuard } from '../../../../../src/modules/vault/application/vaultChunkGuard';
import { CachedVaultRepository } from '../../../../../src/modules/vault/infrastructure/cachedVault.repository';
import { InMemoryVaultRepository } from '../../../../../src/modules/vault/infrastructure/inMemoryVault.repository';
import { computeContentHash, normalizeVaultContent, parseChunkId, VaultEntryStatus } from '../../../../../src/modules/vault/domain';
import { logger } from '../../../../../src/shared/logging/logger';
import { FakeEmbedder, FakeObjectStorage, FakeVectorStore, flaky, vectorIndexOf, type StorageOp, type VectorOp } from '../../../../support/countingAdapters';

/**
 * Model-based test (note 11 §3.2): random sequences of upload / edit / rename /
 * delete file / delete folder / index / reconcile, with random failures injected
 * into object storage, the vector index, the manifest and the embedder. After
 * the faults stop and the system settles (reconcile + index + reconcile), the
 * three stores must agree with a plain Map model:
 *
 * I1 every row points at an existing object whose sha256 and content hash match
 * I2 manifest chunk ids == vector ids
 * I3 no vector or object of a deleted document
 * I4 (separate unit test) unchanged upload → 0 put, 0 embed
 * I5 no dangling pointer; everything indexed
 * I6 chunk ids unique across the vault (Vietnamese names included)
 */
const NAMES = ['a.md', 'Bài 1.md', 'Bái 1.md', 'f/x.md', 'f/y.md', 'f/sub/z.md', 'g/w.md'];
const FOLDERS = ['f', 'f/sub', 'g'];
const BODIES = ['## A\nalpha', '## A\nbeta', '## Giới thiệu\nnội dung', '## B\n' + 'long '.repeat(400), 'plain text no heading'];
const STORAGE_FAULTS: StorageOp[] = ['put', 'get', 'delete', 'deleteMany', 'deletePrefix', 'list'];
const VECTOR_FAULTS: VectorOp[] = ['upsert', 'deleteByIds', 'deleteAll', 'listIds'];
const REPO_FAULTS = ['saveVersion', 'commitIndexed', 'markFailed', 'rename', 'markDeleting', 'markFolderDeleting', 'removeDeleted', 'removeAllDeleted'] as const;

type Fault =
  | { at: 'storage'; op: StorageOp }
  | { at: 'vectors'; op: VectorOp }
  | { at: 'repo'; op: (typeof REPO_FAULTS)[number] }
  | { at: 'embed' };

type Op =
  | { kind: 'upload'; name: string; body: string; fault?: Fault }
  | { kind: 'rename'; from: string; to: string; fault?: Fault }
  | { kind: 'delete'; name: string; fault?: Fault }
  | { kind: 'deleteFolder'; folder: string; fault?: Fault }
  | { kind: 'deleteAll'; fault?: Fault }
  | { kind: 'index'; fault?: Fault }
  | { kind: 'reconcile'; fault?: Fault };

const faultArb: fc.Arbitrary<Fault | undefined> = fc.option(fc.oneof(
  fc.constantFrom(...STORAGE_FAULTS).map((op) => ({ at: 'storage' as const, op })),
  fc.constantFrom(...VECTOR_FAULTS).map((op) => ({ at: 'vectors' as const, op })),
  fc.constantFrom(...REPO_FAULTS).map((op) => ({ at: 'repo' as const, op })),
  fc.constant({ at: 'embed' as const }),
), { nil: undefined, freq: 3 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant('upload' as const), name: fc.constantFrom(...NAMES), body: fc.constantFrom(...BODIES), fault: faultArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('rename' as const), from: fc.constantFrom(...NAMES), to: fc.constantFrom(...NAMES), fault: faultArb }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('delete' as const), name: fc.constantFrom(...NAMES), fault: faultArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('deleteFolder' as const), folder: fc.constantFrom(...FOLDERS), fault: faultArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('deleteAll' as const), fault: faultArb }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('index' as const), fault: faultArb }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('reconcile' as const), fault: faultArb }) },
);

function sha256(body: Buffer): string {
  return crypto.createHash('sha256').update(body).digest('hex');
}

async function runScenario(ops: Op[]): Promise<void> {
  let clock = 0;
  const inner = flaky(new InMemoryVaultRepository());
  const repo = new CachedVaultRepository(inner.proxy);
  const storage = new FakeObjectStorage(() => clock);
  const vectors = new FakeVectorStore();
  const embedder = new FakeEmbedder();
  const service = new VaultService(repo, vectorIndexOf(vectors), storage, undefined, { now: () => clock, orphanGraceMs: 10 });
  const index = () => new KnowledgeIndexer({ embeddingProvider: EmbeddingProvider.GEMINI, embeddingBatchSize: 4, embeddingDelayMs: 0 }, embedder, repo, vectors, service.documents, async () => undefined).indexAll();
  const model = new Map<string, string>();

  const inject = (fault?: Fault) => {
    if (!fault) return;
    if (fault.at === 'storage') storage.faults.failNext(fault.op);
    else if (fault.at === 'vectors') vectors.faults.failNext(fault.op);
    else if (fault.at === 'repo') inner.failNext(fault.op);
    else embedder.failNext();
  };
  const tryRun = async (fn: () => Promise<unknown>) => {
    try { await fn(); return true; } catch { return false; }
  };

  for (const op of ops) {
    clock += 5;
    inject(op.fault);
    switch (op.kind) {
      case 'upload': {
        const [r] = await service.uploadFiles([{ rawName: op.name, content: op.body }]);
        if (!('error' in r)) model.set(op.name, op.body);
        break;
      }
      case 'rename': {
        const ok = await tryRun(() => service.renameFile(op.from, op.to));
        if (ok && op.from !== op.to && model.has(op.from)) {
          model.set(op.to, model.get(op.from)!);
          model.delete(op.from);
        }
        break;
      }
      case 'delete': {
        if (await tryRun(() => service.deleteFile(op.name))) model.delete(op.name);
        break;
      }
      case 'deleteFolder': {
        if (await tryRun(() => service.deleteFolder(op.folder))) {
          for (const name of [...model.keys()]) if (name.startsWith(`${op.folder}/`)) model.delete(name);
        }
        break;
      }
      case 'deleteAll': {
        if (await tryRun(() => service.deleteAll())) model.clear();
        break;
      }
      case 'index':
        await tryRun(index);
        break;
      case 'reconcile':
        await tryRun(() => repo.refresh().then(() => service.reconcile()));
        break;
    }
  }

  // The outage is over: pending (untriggered) faults are dropped, then the system settles.
  storage.faults.clearPending();
  vectors.faults.clearPending();
  inner.clearFaults();
  embedder.clearFaults();
  for (let round = 0; round < 2; round++) {
    clock += 1_000;
    await tryRun(() => repo.refresh().then(() => service.reconcile()));
    await tryRun(index);
  }
  clock += 1_000;
  await repo.refresh();
  await service.reconcile();

  const rows = await repo.findAll();
  expect(await repo.findDeleting()).toEqual([]);
  // Model agreement (paths + content).
  expect(rows.map((r) => r.filePath).sort()).toEqual([...model.keys()].sort());
  for (const row of rows) {
    // I1
    const object = storage.objects.get(row.objectKey);
    expect(object, `object of ${row.filePath}`).toBeDefined();
    expect(object!.metadata.sha256).toBe(sha256(object!.body));
    expect(computeContentHash(object!.body.toString('utf-8'))).toBe(row.hash);
    expect(object!.body.toString('utf-8')).toBe(normalizeVaultContent(model.get(row.filePath)!));
    // I5
    expect(row.status).toBe(VaultEntryStatus.ACTIVE);
    expect(row.indexedHash).toBe(row.hash);
  }
  // I2 + I6
  const manifestIds = rows.flatMap((r) => r.chunkIds);
  expect(new Set(manifestIds).size).toBe(manifestIds.length);
  expect(vectors.ids()).toEqual([...manifestIds].sort());
  // I3: vectors and objects only of live documents
  const liveDocs = new Set(rows.map((r) => r.docId));
  expect(vectors.ids().every((id) => liveDocs.has(parseChunkId(id)!.docId))).toBe(true);
  expect(storage.keys('vault/').sort()).toEqual(rows.map((r) => r.objectKey).sort());
  // Read-side guard shows exactly the live versions.
  const guard = createVaultChunkGuard(repo);
  const visible = guard(await vectors.query([], 10_000));
  expect(new Set(visible.map((c) => c.source))).toEqual(new Set(rows.filter((r) => r.chunkIds.length > 0).map((r) => r.filePath)));
}

describe('vault sync invariants under random faults (property)', () => {
  it('I1–I6 hold after any operation sequence once the system settles', async () => {
    const restore = { info: logger.info, warn: logger.warn };
    logger.info = () => undefined;
    logger.warn = () => undefined;
    try {
      await fc.assert(
        fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 25 }), runScenario),
        { numRuns: Number(process.env.PROPERTY_RUNS ?? 200), seed: process.env.PROPERTY_SEED ? Number(process.env.PROPERTY_SEED) : undefined },
      );
    } finally {
      logger.info = restore.info;
      logger.warn = restore.warn;
    }
  }, 120_000);
});
