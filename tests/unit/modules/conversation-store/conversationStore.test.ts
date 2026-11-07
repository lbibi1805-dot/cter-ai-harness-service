import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  ArtifactKind,
  ConversationService,
  ConversationStateKey,
  InMemoryConversationStore,
  MessageKind,
  MessageRole,
  NeonConversationStore,
  conversationPrefix,
  type ConversationStore,
  type TurnWrite,
} from '../../../../src/modules/conversation-store';
import { NotFoundError, ValidationError } from '../../../../src/shared/errors';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { PgliteSqlClient } from '../../../support/pgliteSqlClient';

function turn(conversationId: string, user: string, assistant: string, extra: Partial<TurnWrite> = {}): TurnWrite {
  const userId = randomUUID();
  return {
    conversationId,
    title: user,
    messages: [
      { id: userId, role: MessageRole.USER, kind: MessageKind.CHAT, text: user },
      { id: randomUUID(), role: MessageRole.ASSISTANT, kind: MessageKind.CHAT, text: assistant, provider: 'gemini', model: 'm', latencyMs: 120, ttftMs: 40, sources: [{ source: 'a.md' }] },
    ],
    artifacts: [],
    ...extra,
  };
}

let pg: PgliteSqlClient;
// PGlite boots its WASM on the first query: slow when the whole suite runs in parallel.
const PGLITE_HOOK_TIMEOUT = 60_000;
beforeAll(async () => { pg = new PgliteSqlClient(); });
afterAll(async () => { await pg.close(); });

const stores: [string, () => Promise<ConversationStore>][] = [
  ['NeonConversationStore (PGlite)', async () => {
    await pg.db.exec('DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;');
    pg.resetCounters();
    return new NeonConversationStore(pg);
  }],
  ['InMemoryConversationStore', async () => new InMemoryConversationStore()],
];

describe.each(stores)('ConversationStore contract: %s', (_name, make) => {
  let store: ConversationStore;
  beforeEach(async () => { store = await make(); }, PGLITE_HOOK_TIMEOUT);

  it('load returns null for an unknown id; recordTurn creates the conversation with ordered seqs', async () => {
    const id = randomUUID();
    expect(await store.load(id, 50, 40)).toBeNull();
    await store.recordTurn(turn(id, 'q1', 'a1'));
    await store.recordTurn(turn(id, 'q2', 'a2'));
    const snap = await store.load(id, 50, 40);
    expect(snap).toMatchObject({ id, title: 'q1', summaryUptoSeq: 0, lastSeq: 4, deletedAt: null, artifactCount: 0 });
    expect(snap!.messages.map((m) => [m.seq, m.role, m.text])).toEqual([[1, 'user', 'q1'], [2, 'assistant', 'a1'], [3, 'user', 'q2'], [4, 'assistant', 'a2']]);
  });

  it('artifacts get increasing ordinals and know their message seq', async () => {
    const id = randomUUID();
    const t1 = turn(id, 'look', 'ok');
    t1.artifacts = [{ id: randomUUID(), messageId: t1.messages[0].id, kind: ArtifactKind.USER_IMAGE, objectKey: `conversations/${id}/x.png`, mime: 'image/png', sha256: 's', sizeBytes: 3 }];
    await store.recordTurn(t1);
    const t2 = turn(id, 'again', 'ok');
    t2.artifacts = [
      { id: randomUUID(), messageId: t2.messages[1].id, kind: ArtifactKind.C4_SPEC, dataJson: { systemName: 'Ticketing' } },
      { id: randomUUID(), messageId: t2.messages[1].id, kind: ArtifactKind.C4_PUML, dataJson: { puml: '@startuml' } },
    ];
    await store.recordTurn(t2);
    const snap = (await store.load(id, 50, 40))!;
    expect(snap.artifacts.map((a) => [a.ordinal, a.kind, a.messageSeq])).toEqual([[1, 'user_image', 1], [2, 'c4_spec', 4], [3, 'c4_puml', 4]]);
    expect(snap.artifacts[1].dataJson).toEqual({ systemName: 'Ticketing' });
    expect(snap.artifactCount).toBe(3);

    await store.enrichArtifacts([{ id: snap.artifacts[0].id, caption: 'Đề bài', ocrText: 'NFR 1' }]);
    expect((await store.load(id, 50, 40))!.artifacts[0]).toMatchObject({ caption: 'Đề bài', ocrText: 'NFR 1' });
  });

  it('load only returns messages after the summary, newest N', async () => {
    const id = randomUUID();
    for (let i = 1; i <= 4; i++) await store.recordTurn(turn(id, `q${i}`, `a${i}`));
    expect(await store.saveSummary(id, 'S1', 4, 0)).toBe(true);
    expect(await store.saveSummary(id, 'stale', 6, 0)).toBe(false);          // optimistic check
    const snap = (await store.load(id, 3, 40))!;
    expect(snap.summary).toBe('S1');
    expect(snap.messages.map((m) => m.seq)).toEqual([6, 7, 8]);
  });

  it('soft delete hides the conversation from reads (findActive/list) but keeps it restorable', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    expect(await store.softDelete(id, 30)).toBe(true);
    expect(await store.softDelete(id, 30)).toBe(true);                        // idempotent
    expect(await store.findActive(id, 100)).toBeNull();
    expect((await store.list(10, false)).map((c) => c.id)).not.toContain(id);
    expect((await store.list(10, true)).map((c) => c.id)).toContain(id);
    expect((await store.load(id, 10, 10))?.deletedAt).not.toBeNull();
    expect(await store.findPurgeable(10)).toEqual([]);                        // 30-day window not over

    expect(await store.restore(id)).toBe(true);
    expect((await store.findActive(id, 100))?.messages).toHaveLength(2);
    expect(await store.softDelete(randomUUID(), 30)).toBe(false);
  });

  it('a 0-day window makes it purgeable; deleteRows cascades', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    await store.softDelete(id, 0);
    expect(await store.findPurgeable(10)).toEqual([id]);
    expect(await store.deleteRows([id])).toBe(1);
    expect(await store.load(id, 10, 10)).toBeNull();
    expect(await store.restore(id)).toBe(false);
  });

  it('pending workflow state: set, take atomically by value id, then gone', async () => {
    const id = randomUUID();
    await store.setState(id, ConversationStateKey.PENDING_C4, { id: 'sess-1', stage: 'clarify' }, '/c4');
    expect((await store.load(id, 10, 10))!.state).toEqual({ pendingC4: { id: 'sess-1', stage: 'clarify' } });
    expect(await store.takeStateById(ConversationStateKey.PENDING_C4, 'nope')).toBeNull();
    expect(await store.takeStateById(ConversationStateKey.PENDING_C4, 'sess-1')).toEqual({ conversationId: id, value: { id: 'sess-1', stage: 'clarify' } });
    expect(await store.takeStateById(ConversationStateKey.PENDING_C4, 'sess-1')).toBeNull();
    expect((await store.load(id, 10, 10))!.state).toEqual({});
  });

  it('findActive returns full message rows (timings, sources)', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    const detail = (await store.findActive(id, 100))!;
    expect(detail.messages[1]).toMatchObject({ provider: 'gemini', model: 'm', latencyMs: 120, ttftMs: 40, sources: [{ source: 'a.md' }] });
  });
});

describe('NeonConversationStore budget (note 13: ≤ 2 round-trips per turn)', () => {
  it('load = 1 round-trip, recordTurn (messages + artifacts + state) = 1 transaction', async () => {
    await pg.db.exec('DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;');
    const store = new NeonConversationStore(pg);
    const id = randomUUID();
    await store.load(id, 10, 10);                                             // schema applied once per process
    pg.resetCounters();

    await store.load(id, 80, 40);
    const t = turn(id, 'q', 'a', { state: { [ConversationStateKey.PENDING_C4]: null } });
    t.artifacts = [{ id: randomUUID(), messageId: t.messages[0].id, kind: ArtifactKind.USER_IMAGE, objectKey: `conversations/${id}/i.png` }];
    await store.recordTurn(t);
    expect(pg.roundTrips).toBe(2);
  });

  it('a failing statement rolls the whole turn back', async () => {
    const store = new NeonConversationStore(pg);
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q1', 'a1'));
    const bad = turn(id, 'q2', 'a2');
    bad.artifacts = [{ id: 'not-a-uuid', messageId: bad.messages[0].id, kind: ArtifactKind.USER_IMAGE }];
    await expect(store.recordTurn(bad)).rejects.toThrow();
    expect((await store.load(id, 10, 10))!.messages).toHaveLength(2);
  });
});

describe('ConversationService', () => {
  let store: InMemoryConversationStore;
  let storage: FakeObjectStorage;
  let clock: number;
  let service: ConversationService;
  beforeEach(() => {
    clock = 0;
    store = new InMemoryConversationStore(() => new Date(clock));
    storage = new FakeObjectStorage();
    service = new ConversationService(store, storage, { purgeDays: 30, now: () => clock, maintenanceIntervalMs: 1000 });
  });

  it('get presigns artifact URLs; soft-deleted → 404; restore brings images back', async () => {
    const id = randomUUID();
    const t = turn(id, 'q', 'a');
    const artifactId = randomUUID();
    const ref = await service.putArtifactObject(id, artifactId, Buffer.from('png'), 'image/png');
    expect(ref.objectKey).toBe(`conversations/${id}/${artifactId}.png`);
    t.artifacts = [{ id: artifactId, messageId: t.messages[0].id, kind: ArtifactKind.USER_IMAGE, mime: 'image/png', ...ref }];
    await store.recordTurn(t);

    expect((await service.get(id)).artifacts[0].url).toBe(`https://signed.example/conversations/${id}/${artifactId}.png`);
    await service.softDelete(id);
    await expect(service.get(id)).rejects.toBeInstanceOf(NotFoundError);
    expect(storage.keys(conversationPrefix(id))).toHaveLength(1);              // files kept for restore
    await service.restore(id);
    expect((await service.readArtifact(id, artifactId)).body.toString()).toBe('png');
  });

  it('rejects ids that are not UUIDs', async () => {
    await expect(service.get('../x')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.softDelete('1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('purge removes objects first, then rows; only past the window; at most once per interval', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    await service.putArtifactObject(id, randomUUID(), Buffer.from('x'), 'image/png');
    await service.softDelete(id);
    expect(await service.purgeExpired()).toBe(0);

    clock = 31 * 24 * 3600 * 1000;
    storage.faults.failNext('deletePrefix');
    expect(await service.purgeExpired()).toBe(0);                              // object purge failed → row kept
    expect(await store.load(id, 1, 1)).not.toBeNull();
    expect(await service.purgeExpired()).toBe(1);
    expect(storage.keys(conversationPrefix(id))).toEqual([]);
    expect(await store.load(id, 1, 1)).toBeNull();
  });

  it('hard delete purges now', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    await service.putArtifactObject(id, randomUUID(), Buffer.from('x'), 'image/png');
    await service.hardDelete(id);
    expect(storage.keys()).toEqual([]);
    await expect(service.restore(id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
