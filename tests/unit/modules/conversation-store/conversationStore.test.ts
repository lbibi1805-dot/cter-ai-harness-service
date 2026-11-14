import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import {
  ArtifactKind,
  ConversationService,
  ConversationStateKey,
  InMemoryConversationStore,
  TitleSource,
  MessageKind,
  MessageRole,
  NeonConversationStore,
  conversationPrefix,
  type ConversationCursor,
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
    expect((await store.list({ limit: 10, deleted: false })).conversations.map((c) => c.id)).not.toContain(id);
    expect((await store.list({ limit: 10, deleted: true })).conversations.map((c) => c.id)).toContain(id);
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

  it('008: messages keep the C4 intent; findActive returns state; list filters ?pending', async () => {
    const waiting = randomUUID();
    const idle = randomUUID();
    const intent = { intent: 'c4_review', intentConfidence: 0.75 };
    await store.recordTurn({
      conversationId: waiting, title: '/c4', artifacts: [],
      messages: [
        { id: randomUUID(), role: MessageRole.USER, kind: MessageKind.C4_REVIEW, text: '/c4 --review', ...intent },
        { id: randomUUID(), role: MessageRole.ASSISTANT, kind: MessageKind.C4_REVIEW, text: 'ok', ...intent },
      ],
    });
    await store.setState(waiting, ConversationStateKey.PENDING_C4, { id: 's1', step: 'clarify', questions: [{ slot: 'levels' }] }, '/c4');
    await store.recordTurn(turn(idle, 'q', 'a'));

    const detail = await store.findActive(waiting, 50);
    expect(detail!.messages.map((m) => [m.intent, m.intentConfidence])).toEqual([['c4_review', 0.75], ['c4_review', 0.75]]);
    expect(detail!.state).toEqual({ pendingC4: { id: 's1', step: 'clarify', questions: [{ slot: 'levels' }] } });
    expect((await store.findActive(idle, 50))!.messages[0]).toMatchObject({ intent: null, intentConfidence: null });
    const pending = (await store.list({ limit: 10, deleted: false, pending: ConversationStateKey.PENDING_C4 })).conversations;
    expect(pending.map((c) => [c.id, c.pending])).toEqual([[waiting, ['pendingC4']]]);
    expect((await store.list({ limit: 10, deleted: false })).conversations.map((c) => c.id).sort()).toEqual([waiting, idle].sort());
  });

  it('009: keyset list pages through every conversation once, newest first, with a next position', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) { const id = randomUUID(); ids.push(id); await store.recordTurn(turn(id, `q${i}`, 'a')); }
    const seen: string[] = [];
    let after: ConversationCursor | undefined;
    for (let pageNo = 0; pageNo < 5; pageNo++) {
      const page = await store.list({ limit: 2, deleted: false, after });
      seen.push(...page.conversations.map((c) => c.id));
      if (!page.next) break;
      after = page.next;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
    const all = (await store.list({ limit: 10, deleted: false })).conversations;
    expect(all.map((c) => c.id)).toEqual(seen);                               // same order as one big page
    expect((await store.list({ limit: 5, deleted: false })).next).toBeNull();  // exact fit → no next page
    expect(all.every((c) => c.titleSource === TitleSource.AUTO)).toBe(true);
  });

  it('009: rename sets/clears the user title, keeps updated_at and the generated title; deleted → null', async () => {
    const older = randomUUID();
    const newer = randomUUID();
    await store.recordTurn(turn(older, 'first question', 'a'));
    await new Promise((r) => setTimeout(r, 5));
    await store.recordTurn(turn(newer, 'second', 'a'));
    const before = (await store.list({ limit: 10, deleted: false })).conversations;

    expect(await store.rename(older, 'Thiết kế vé')).toEqual({ id: older, title: 'Thiết kế vé', titleSource: TitleSource.USER });
    const after = (await store.list({ limit: 10, deleted: false })).conversations;
    expect(after.map((c) => [c.id, c.updatedAt])).toEqual(before.map((c) => [c.id, c.updatedAt]));   // not moved to the top
    expect(after.find((c) => c.id === older)).toMatchObject({ title: 'Thiết kế vé', titleSource: TitleSource.USER });
    expect(await store.findActive(older, 10)).toMatchObject({ title: 'Thiết kế vé', titleSource: TitleSource.USER });

    expect(await store.rename(older, null)).toEqual({ id: older, title: 'first question', titleSource: TitleSource.AUTO });
    await store.softDelete(newer, 30);
    expect(await store.rename(newer, 'x')).toBeNull();
    expect(await store.rename(randomUUID(), 'x')).toBeNull();
  });

  it('009: detail returns the newest N with hasMoreMessages/oldestSeq; findMessages pages older ones with their artifacts', async () => {
    const id = randomUUID();
    const imageIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const t = turn(id, `q${i}`, `a${i}`);
      const artifactId = randomUUID();
      imageIds.push(artifactId);
      t.artifacts = [{ id: artifactId, messageId: t.messages[0].id, kind: ArtifactKind.USER_IMAGE, objectKey: `conversations/${id}/${artifactId}.png`, mime: 'image/png' }];
      await store.recordTurn(t);
    }
    const detail = (await store.findActive(id, 2))!;
    expect(detail.messages.map((m) => m.seq)).toEqual([5, 6]);
    expect(detail).toMatchObject({ hasMoreMessages: true, oldestSeq: 5 });
    expect(detail.artifacts).toHaveLength(3);                                 // detail keeps every artifact (metadata only)
    expect(await store.findActive(id, 6)).toMatchObject({ hasMoreMessages: false, oldestSeq: 1 });

    const older = (await store.findMessages(id, 5, 3))!;
    expect(older.messages.map((m) => m.seq)).toEqual([2, 3, 4]);
    expect(older).toMatchObject({ hasMoreMessages: true, oldestSeq: 2 });
    expect(older.artifacts.map((a) => [a.id, a.messageSeq])).toEqual([[imageIds[1], 3]]);   // seq 1's image is not on this page
    const oldest = (await store.findMessages(id, 2, 40))!;
    expect(oldest).toMatchObject({ hasMoreMessages: false, oldestSeq: 1 });
    expect(oldest.artifacts.map((a) => a.id)).toEqual([imageIds[0]]);
    expect(await store.findMessages(id, 1, 40)).toMatchObject({ messages: [], hasMoreMessages: false, oldestSeq: null });
    expect((await store.findMessages(id, null, 2))!.messages.map((m) => m.seq)).toEqual([5, 6]);

    expect(await store.findActiveArtifact(id, imageIds[2])).toMatchObject({ id: imageIds[2], objectKey: `conversations/${id}/${imageIds[2]}.png` });
    expect(await store.findActiveArtifact(randomUUID(), imageIds[2])).toBeNull();
    await store.softDelete(id, 30);
    expect(await store.findMessages(id, null, 40)).toBeNull();
    expect(await store.findActiveArtifact(id, imageIds[2])).toBeNull();
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

  it('009: list/rename/detail/messages/artifact are 1 round-trip each', async () => {
    await pg.db.exec('DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;');
    const store = new NeonConversationStore(pg);
    const id = randomUUID();
    const t = turn(id, 'q', 'a');
    const artifactId = randomUUID();
    t.artifacts = [{ id: artifactId, messageId: t.messages[0].id, kind: ArtifactKind.USER_IMAGE, objectKey: `conversations/${id}/i.png` }];
    await store.recordTurn(t);                                                // schema applied once per process
    pg.resetCounters();

    const page = await store.list({ limit: 3, deleted: false, after: { updatedAt: '2999-01-01T00:00:00.000000Z', id: randomUUID() } });
    expect(pg.roundTrips).toBe(1);
    await store.rename(id, 'Tên mới');
    expect(pg.roundTrips).toBe(2);
    await store.findActive(id, 40);
    expect(pg.roundTrips).toBe(3);
    await store.findMessages(id, 2, 40);
    expect(pg.roundTrips).toBe(4);
    await store.findActiveArtifact(id, artifactId);
    expect(pg.roundTrips).toBe(5);
    expect(page.conversations.map((c) => c.id)).toEqual([id]);
  });

  it('009: keyset is exact at a microsecond updated_at shared by several rows (id breaks the tie)', async () => {
    await pg.db.exec('DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;');
    const store = new NeonConversationStore(pg);
    const ids = Array.from({ length: 5 }, () => randomUUID());
    for (const id of ids) await store.recordTurn(turn(id, 'q', 'a'));
    await pg.db.query("UPDATE conversations SET updated_at = '2026-11-13 10:00:00.123456+00'");
    await pg.db.query("UPDATE conversations SET updated_at = '2026-11-13 10:00:00.123457+00' WHERE id = $1::uuid", [ids[0]]);
    const seen: string[] = [];
    const cursors: ConversationCursor[] = [];
    let after: ConversationCursor | undefined;
    do {
      const page = await store.list({ limit: 2, deleted: false, after });
      seen.push(...page.conversations.map((c) => c.id));
      after = page.next ?? undefined;
      if (after) cursors.push(after);
    } while (after);
    expect(seen[0]).toBe(ids[0]);                                             // 1 µs newer than the rest
    expect(seen.slice(1)).toEqual(ids.slice(1).sort().reverse());             // same timestamp → id DESC
    expect(cursors[0].updatedAt).toBe('2026-11-13T10:00:00.123456Z');         // µs kept (a JS Date would lose them)
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

  it('009: listPage returns an opaque nextCursor; a bad cursor is invalid_cursor', async () => {
    for (let i = 0; i < 4; i++) { clock = i * 1000; await store.recordTurn(turn(randomUUID(), `q${i}`, 'a')); }
    const first = await service.listPage({ limit: 3, deleted: false });
    expect(first.conversations.map((c) => c.title)).toEqual(['q3', 'q2', 'q1']);
    expect(first.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    const second = await service.listPage({ limit: 20, deleted: false, cursor: first.nextCursor! });
    expect(second).toMatchObject({ nextCursor: null });
    expect(second.conversations.map((c) => c.title)).toEqual(['q0']);
    for (const bad of ['%%%', 'abc', Buffer.from('2026-11-13|not-a-uuid').toString('base64url'), Buffer.from(`x'; DROP TABLE x|${randomUUID()}`).toString('base64url')]) {
      await expect(service.listPage({ limit: 3, deleted: false, cursor: bad })).rejects.toThrow('invalid_cursor');
    }
  });

  it('009: rename validates the title (trim, collapse, control chars, 1–80) and 404s a deleted conversation', async () => {
    const id = randomUUID();
    await store.recordTurn(turn(id, 'q', 'a'));
    expect(await service.rename(id, '  Hệ thống\n\t đặt   vé \u0007 ')).toEqual({ id, title: 'Hệ thống đặt vé', titleSource: 'user' });
    expect(await service.rename(id, '')).toEqual({ id, title: 'q', titleSource: 'auto' });
    expect(await service.rename(id, 'x'.repeat(80))).toMatchObject({ title: 'x'.repeat(80) });
    for (const bad of ['   ', 'x'.repeat(81), 42, undefined, { t: 1 }]) {
      await expect(service.rename(id, bad)).rejects.toThrow('invalid_title');
    }
    await service.softDelete(id);
    await expect(service.rename(id, 'x')).rejects.toBeInstanceOf(NotFoundError);
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
