import { ObjectMetadataKey, ObjectStorageKind, assertValidKey, assertValidPrefix, sha256Hex, type ObjectInfo, type ObjectStorage, type PutObjectOptions, type StoredObject } from '../../src/shared/storage';
import type { VectorChunkMetadata, VectorIndex } from '../../src/modules/vault/domain';
import { EmbeddingProvider, type CitedChunk, type IndexedChunk, type VectorStore, type EmbeddingService } from '../../src/modules/retrieval';

/** Shared fault-injection helper: `failNext('put')` makes the next `put` throw once. */
class Faults<Op extends string> {
  private readonly pending = new Map<Op, number>();
  readonly calls = new Map<Op, number>();

  failNext(op: Op, times = 1): void {
    this.pending.set(op, (this.pending.get(op) ?? 0) + times);
  }

  hit(op: Op): void {
    this.calls.set(op, (this.calls.get(op) ?? 0) + 1);
    const left = this.pending.get(op) ?? 0;
    if (left > 0) {
      this.pending.set(op, left - 1);
      throw new Error(`injected ${op} failure`);
    }
  }

  count(op: Op): number {
    return this.calls.get(op) ?? 0;
  }

  reset(): void {
    this.calls.clear();
  }

  /** Drops failures injected but not triggered yet ("the outage is over"). */
  clearPending(): void {
    this.pending.clear();
  }
}

export type StorageOp = 'put' | 'get' | 'head' | 'delete' | 'deleteMany' | 'deletePrefix' | 'list';

/** In-memory object storage with call counters, fault injection and a controllable clock. */
export class FakeObjectStorage implements ObjectStorage {
  readonly kind = ObjectStorageKind.LOCAL_DISK;
  readonly location = 'memory://test';
  readonly faults = new Faults<StorageOp>();
  readonly objects = new Map<string, { body: Buffer; contentType: string; metadata: Record<string, string>; lastModified: Date }>();

  constructor(public now: () => number = Date.now) {}

  async put(key: string, body: Buffer | string, options: PutObjectOptions): Promise<void> {
    assertValidKey(key);
    this.faults.hit('put');
    const bytes = typeof body === 'string' ? Buffer.from(body) : body;
    this.objects.set(key, { body: bytes, contentType: options.contentType, metadata: { ...options.metadata, [ObjectMetadataKey.SHA256]: sha256Hex(bytes) }, lastModified: new Date(this.now()) });
  }

  async get(key: string): Promise<StoredObject | null> {
    this.faults.hit('get');
    const o = this.objects.get(key);
    return o ? { body: o.body, contentType: o.contentType, metadata: o.metadata } : null;
  }

  async head(key: string): Promise<ObjectInfo | null> {
    this.faults.hit('head');
    const o = this.objects.get(key);
    return o ? { key, size: o.body.length, lastModified: o.lastModified, metadata: o.metadata } : null;
  }

  async delete(key: string): Promise<void> {
    this.faults.hit('delete');
    this.objects.delete(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    this.faults.hit('deleteMany');
    for (const key of keys) this.objects.delete(key);
  }

  async deletePrefix(prefix: string): Promise<number> {
    assertValidPrefix(prefix);
    this.faults.hit('deletePrefix');
    const keys = [...this.objects.keys()].filter((k) => k.startsWith(prefix));
    for (const key of keys) this.objects.delete(key);
    return keys.length;
  }

  async list(prefix: string): Promise<ObjectInfo[]> {
    this.faults.hit('list');
    return [...this.objects.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, o]) => ({ key, size: o.body.length, lastModified: o.lastModified }));
  }

  async presignGet(key: string): Promise<string | null> {
    return `https://signed.example/${key}`;
  }

  keys(prefix = ''): string[] {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

export type VectorOp = 'upsert' | 'query' | 'deleteByIds' | 'deleteAll' | 'listIds' | 'fetch' | 'ensureIndex';

/** In-memory vector store (retrieval port) — also exposed as the vault's VectorIndex. */
export class FakeVectorStore implements VectorStore {
  readonly faults = new Faults<VectorOp>();
  readonly records = new Map<string, IndexedChunk>();

  async ensureIndex(): Promise<void> {
    this.faults.hit('ensureIndex');
  }

  async upsertChunks(chunks: IndexedChunk[]): Promise<void> {
    this.faults.hit('upsert');
    for (const c of chunks) this.records.set(c.id, { ...c });
  }

  /** Returns every record, scored by insertion order (tests check filtering, not ranking). */
  async query(_vector: number[], topK: number): Promise<CitedChunk[]> {
    this.faults.hit('query');
    return [...this.records.values()].slice(0, topK).map((c, i) => ({
      chunkId: c.id, text: c.text, source: c.source, heading: c.heading, parentHeading: c.parentHeading, tokenCount: c.tokenCount,
      score: 1 - i / 100, ...(c.docId ? { docId: c.docId } : {}), ...(c.contentHash ? { contentHash: c.contentHash } : {}),
    }));
  }

  async deleteAll(): Promise<void> {
    this.faults.hit('deleteAll');
    this.records.clear();
  }

  async deleteByIds(ids: string[]): Promise<void> {
    this.faults.hit('deleteByIds');
    for (const id of ids) this.records.delete(id);
  }

  async listIds(prefix?: string): Promise<string[]> {
    this.faults.hit('listIds');
    return [...this.records.keys()].filter((id) => !prefix || id.startsWith(prefix));
  }

  async fetchByIds(ids: string[]): Promise<Record<string, VectorChunkMetadata & { id: string }>> {
    this.faults.hit('fetch');
    const out: Record<string, VectorChunkMetadata & { id: string }> = {};
    for (const id of ids) {
      const c = this.records.get(id);
      if (c) out[id] = { id, text: c.text, source: c.source, heading: c.heading, parentHeading: c.parentHeading, tokenCount: c.tokenCount };
    }
    return out;
  }

  ids(prefix = ''): string[] {
    return [...this.records.keys()].filter((id) => id.startsWith(prefix)).sort();
  }
}

/** The vault's VectorIndex port over the fake store. */
export function vectorIndexOf(store: FakeVectorStore): VectorIndex {
  return {
    deleteByIds: (ids) => store.deleteByIds(ids),
    deleteAll: () => store.deleteAll(),
    fetchMetadata: (ids) => store.fetchByIds(ids),
    listIds: (prefix) => store.listIds(prefix),
  };
}

/** Deterministic embedder; counts texts embedded; `failNext()` fails the next batch. */
export class FakeEmbedder implements EmbeddingService {
  readonly dimension = 3;
  readonly provider = EmbeddingProvider.GEMINI;
  embedded = 0;
  /** Runs inside `embedBatch` (e.g. a concurrent upload while indexing). */
  beforeEmbed?: () => Promise<void>;
  private failures = 0;

  failNext(times = 1): void {
    this.failures += times;
  }

  clearFaults(): void {
    this.failures = 0;
  }

  async embed(text: string): Promise<number[]> {
    return [text.length, 1, 0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.beforeEmbed) {
      const hook = this.beforeEmbed;
      this.beforeEmbed = undefined;
      await hook();
    }
    if (this.failures > 0) {
      this.failures--;
      // Not transient: the indexer gives up on the batch at once.
      throw Object.assign(new Error('injected embedding failure (400)'), { status: 400 });
    }
    this.embedded += texts.length;
    return texts.map((t) => [t.length, 1, 0]);
  }
}

/**
 * Wraps any object so `failNext('method')` makes its next call throw (crash
 * simulation for repositories); calls are counted per method.
 */
export function flaky<T extends object>(target: T): { proxy: T; failNext(method: keyof T & string, times?: number): void; calls(method: keyof T & string): number; clearFaults(): void } {
  const faults = new Faults<string>();
  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value !== 'function' || typeof prop !== 'string') return value;
      return (...args: unknown[]) => {
        faults.hit(prop);
        return (value as (...a: unknown[]) => unknown).apply(obj, args);
      };
    },
  });
  return { proxy, failNext: (method, times = 1) => faults.failNext(method, times), calls: (method) => faults.count(method), clearFaults: () => faults.clearPending() };
}
