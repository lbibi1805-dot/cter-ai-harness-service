import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { AIProvider } from '../../../../src/modules/ai';
import type { C4SketchResult } from '../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { C4Level } from '../../../../src/modules/c4/domain';
import {
  DEFAULT_CONTEXT_SETTINGS,
  DEFAULT_PINNED_KINDS,
  createArtifactTools,
  createContextModule,
  heuristicDesignNote,
  isDesignAnswer,
  type AuxCall,
  type AuxModel,
} from '../../../../src/modules/context';
import {
  ArtifactKind,
  ConversationService,
  InMemoryConversationStore,
  MessageKind,
  MessageRole,
  NeonConversationStore,
  ResolvedRefSource,
  type ConversationStore,
  type TurnWrite,
} from '../../../../src/modules/conversation-store';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { PgliteSqlClient } from '../../../support/pgliteSqlClient';

const PGLITE_HOOK_TIMEOUT = 60_000;
const DROP = 'DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;';

let pg: PgliteSqlClient;
beforeAll(async () => { pg = new PgliteSqlClient(); });
afterAll(async () => { await pg.close(); });

function turnWrite(conversationId: string, artifacts: TurnWrite['artifacts'] = [], extra: Partial<TurnWrite['messages'][number]> = {}): TurnWrite & { ids: [string, string] } {
  const ids: [string, string] = [randomUUID(), randomUUID()];
  return {
    ids,
    conversationId,
    title: 'q',
    messages: [
      { id: ids[0], role: MessageRole.USER, kind: MessageKind.CHAT, text: 'q' },
      { id: ids[1], role: MessageRole.ASSISTANT, kind: MessageKind.CHAT, text: 'a', ...extra },
    ],
    artifacts: artifacts.map((a) => ({ ...a, messageId: a.messageId || ids[1] })),
  };
}

const stores: [string, () => Promise<ConversationStore>][] = [
  ['NeonConversationStore (PGlite)', async () => { await pg.db.exec(DROP); pg.resetCounters(); return new NeonConversationStore(pg); }],
  ['InMemoryConversationStore', async () => new InMemoryConversationStore()],
];

describe.each(stores)('migration 007 columns: %s', (_name, make) => {
  let store: ConversationStore;
  beforeEach(async () => { store = await make(); }, PGLITE_HOOK_TIMEOUT);

  it('label/level/owner/version chain, tokens_cached and resolved_refs round-trip (snapshot + GET detail)', async () => {
    const id = randomUUID();
    const v1 = randomUUID();
    await store.recordTurn(turnWrite(id, [{ id: v1, messageId: '', kind: ArtifactKind.C4_SPEC, label: 'C4 container · Vé', level: 'container', owner: MessageRole.ASSISTANT, dataJson: { systemName: 'Vé' } }]));
    const refs = { ids: ['A1'], source: ResolvedRefSource.RULE, scores: { A1: 4.5 } };
    await store.recordTurn(turnWrite(id, [{ id: randomUUID(), messageId: '', kind: ArtifactKind.C4_SPEC, label: 'C4 container · Vé · v2', level: 'container', owner: MessageRole.ASSISTANT, parentArtifactId: v1, version: 2 }], { tokensIn: 100, tokensOut: 20, tokensCached: 64, resolvedRefs: refs }));

    const snap = (await store.load(id, 50, 40))!;
    expect(snap.artifacts.map((a) => [a.label, a.level, a.owner, a.version, a.parentArtifactId])).toEqual([
      ['C4 container · Vé', 'container', 'assistant', 1, null],
      ['C4 container · Vé · v2', 'container', 'assistant', 2, v1],
    ]);
    const detail = (await store.findActive(id, 100))!;
    expect(detail.messages[3]).toMatchObject({ tokensIn: 100, tokensOut: 20, tokensCached: 64, resolvedRefs: refs });
    expect(detail.messages[1]).toMatchObject({ tokensCached: null, resolvedRefs: null });
    expect(detail.artifacts[1]).toMatchObject({ label: 'C4 container · Vé · v2', version: 2 });
  });

  it('pinned design kinds are loaded outside the newest-N window; enrichment can replace data_json and label', async () => {
    const id = randomUUID();
    const spec = randomUUID();
    await store.recordTurn(turnWrite(id, [{ id: spec, messageId: '', kind: ArtifactKind.C4_SPEC, dataJson: { systemName: 'First' } }]));
    await store.recordTurn(turnWrite(id, Array.from({ length: 5 }, () => ({ id: randomUUID(), messageId: '', kind: ArtifactKind.USER_IMAGE }))));
    expect((await store.load(id, 50, 3))!.artifacts.map((a) => a.ordinal)).toEqual([4, 5, 6]);
    const pinned = (await store.load(id, 50, 3, { kinds: DEFAULT_PINNED_KINDS, max: 10 }))!;
    expect(pinned.artifacts.map((a) => a.ordinal)).toEqual([1, 4, 5, 6]);

    await store.enrichArtifacts([{ id: spec, dataJson: { systemName: 'Refined' }, label: 'Refined' }]);
    const after = (await store.load(id, 50, 3, { kinds: DEFAULT_PINNED_KINDS, max: 10 }))!.artifacts[0];
    expect(after).toMatchObject({ dataJson: { systemName: 'Refined' }, label: 'Refined' });
  });
});

describe('NeonConversationStore: pinned load is still ONE round-trip; 007 is applied to an old 005 schema', () => {
  it('load with pinned kinds = 1 round-trip', async () => {
    await pg.db.exec(DROP);
    const store = new NeonConversationStore(pg);
    const id = randomUUID();
    await store.load(id, 10, 10);                                             // schema once per process
    pg.resetCounters();
    await store.load(id, 80, 40, { kinds: DEFAULT_PINNED_KINDS, max: 60 });
    expect(pg.roundTrips).toBe(1);
  }, PGLITE_HOOK_TIMEOUT);

  it('a database created by 005 (no 007 columns) gets them idempotently at startup', async () => {
    await pg.db.exec(DROP);
    await pg.db.exec(`CREATE TABLE conversations (id UUID PRIMARY KEY, title TEXT, summary TEXT, summary_upto_seq INT NOT NULL DEFAULT 0, state JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ, purge_after TIMESTAMPTZ);
      CREATE TABLE messages (id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, seq INT NOT NULL, role TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'chat', text TEXT NOT NULL DEFAULT '', provider TEXT, model TEXT, mode TEXT, prompt_version TEXT, tokens_in INT, tokens_out INT,
      ttft_ms INT, latency_ms INT, sources JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (conversation_id, seq));
      CREATE TABLE artifacts (id UUID PRIMARY KEY, conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
      ordinal INT NOT NULL DEFAULT 0, kind TEXT NOT NULL, object_key TEXT, mime TEXT, sha256 TEXT, size_bytes BIGINT, caption TEXT, ocr_text TEXT, data_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
    const id = randomUUID();
    await new NeonConversationStore(pg).recordTurn(turnWrite(id, [{ id: randomUUID(), messageId: '', kind: ArtifactKind.DESIGN_NOTE, label: 'L' }], { tokensCached: 5 }));
    await new NeonConversationStore(pg).load(id, 10, 10);                     // a second guard run is a no-op
    expect((await new NeonConversationStore(pg).load(id, 10, 10))!.artifacts[0]).toMatchObject({ label: 'L', version: 1 });
  }, PGLITE_HOOK_TIMEOUT);
});

/** Aux model double: extracts design notes. */
class DesignAux implements AuxModel {
  readonly name = 'fake/aux';
  calls: AuxCall[] = [];
  async complete(call: AuxCall): Promise<string> {
    this.calls.push(call);
    if (call.label === 'aux-design-note') return '{"systemName":"Hệ thống chat realtime","elements":[{"name":"WebSocket Gateway","tech":"Node.js"},{"name":"Cassandra"}],"decisions":["Dùng Cassandra vì ghi nhiều"]}';
    return '';
  }
}

function makeContext(store: ConversationStore, aux: AuxModel | null, hotWindowTurns = DEFAULT_CONTEXT_SETTINGS.hotWindowTurns) {
  const conversations = new ConversationService(store, new FakeObjectStorage());
  return createContextModule(
    { settings: { ...DEFAULT_CONTEXT_SETTINGS, hotWindowTurns }, aux: { provider: AIProvider.GEMINI, model: 'aux' }, timeouts: { imageNoteMs: 1000, imageNoteSyncMs: 1000, rewriteMs: 1000, compactMs: 1000 }, systemPrompt: 'S' },
    { invocation: null as never, store, conversations, isProviderConfigured: () => true, auxModel: aux },
  );
}

function c4Result(systemName: string, elements: string[]): C4SketchResult {
  return {
    provider: AIProvider.GEMINI, model: 'm', systemName, requirements: [], knowledgeSources: [], elapsedMs: 1, deadlineHit: false,
    levels: [{
      level: C4Level.CONTAINER, title: 'Containers', png: Buffer.from('png'), puml: '@startuml\n@enduml',
      spec: { title: 'Containers', elements: elements.map((name, i) => ({ id: `e${i}`, kind: 'container' as never, variant: 'service' as never, external: false, name, desc: '', tech: '', covers: [] })), rels: [] },
      elementCount: elements.length, covered: [], missing: [], notes: [],
    }],
  };
}

const LONG_DESIGN = [
  'Thiết kế hệ thống chat realtime gồm các thành phần:',
  '- WebSocket Gateway: giữ kết nối',
  '- Message Service: lưu và phát tin',
  '- Cassandra: lưu lịch sử tin nhắn',
  '',
  'Chọn Cassandra vì ghi nhiều, đọc theo partition.',
].join('\n');

describe('artifact memory in turns (labels, version chain, UI refs, tokens, design notes)', () => {
  let store: NeonConversationStore;
  beforeEach(async () => { await pg.db.exec(DROP); store = new NeonConversationStore(pg); }, PGLITE_HOOK_TIMEOUT);

  it('C4 runs get labels; a second run of the same system is v2 of the first', async () => {
    const context = makeContext(store, null);
    const id = randomUUID();
    await context.c4Recorder.record({ conversationId: id, userText: 'vé', images: [], result: c4Result('Hệ thống đặt vé', ['Web App']), paused: false });
    await context.c4Recorder.record({ conversationId: id, userText: 'thêm Redis', images: [], result: c4Result('Hệ thống đặt vé', ['Web App', 'Redis']), paused: false });
    const snap = (await store.load(id, 50, 40))!;
    expect(snap.artifacts.map((a) => [a.kind, a.label, a.level, a.version])).toEqual([
      ['c4_spec', 'C4 container · Hệ thống đặt vé', 'container', 1],
      ['c4_png', 'Sơ đồ C4 container · Hệ thống đặt vé', 'container', 1],
      ['c4_puml', 'PlantUML container · Hệ thống đặt vé', 'container', 1],
      ['c4_spec', 'C4 container · Hệ thống đặt vé · v2', 'container', 2],
      ['c4_png', 'Sơ đồ C4 container · Hệ thống đặt vé · v2', 'container', 2],
      ['c4_puml', 'PlantUML container · Hệ thống đặt vé · v2', 'container', 2],
    ]);
    expect(snap.artifacts[3].parentArtifactId).toBe(snap.artifacts[0].id);

    // "bản trước đó" → v1 (parent of the head); the UI ref wins over the words.
    const prev = await context.turns.begin({ conversationId: id, question: 'thiết kế bản trước đó', images: [], clientHistory: [] });
    expect(prev.resolvedRefs).toMatchObject({ ids: ['A1'], source: ResolvedRefSource.RULE });
    const ui = await context.turns.begin({ conversationId: id, question: 'thiết kế bản trước đó', images: [], clientHistory: [], refArtifactIds: ['A4'] });
    expect(ui.resolvedRefs).toMatchObject({ ids: ['A4'], source: ResolvedRefSource.UI });
    expect(ui.content.jitContext).toContain('--- [A4] c4_spec');
    // Hot window (default 2 pairs): the v2 PNG is already in place on the assistant turn that drew it → not re-attached.
    expect(ui.content.imageBuffers).toHaveLength(0);
    expect(ui.content.history?.at(-1)?.images?.map((i) => i.alias)).toEqual(['A5']);
    expect(ui.content.jitContext).toContain('[A5] c4_png');
    expect(ui.content.jitContext).toContain('already shown in place');

    await ui.finish({ text: 'Dựa trên [A4] …', provider: 'gemini', model: 'm', mode: 'single-shot', durationMs: 10, sources: [], tokensIn: 1200, tokensOut: 80, tokensCached: 1024 });
    await context.turns.idle();
    const detail = (await store.findActive(id, 100))!;
    expect(detail.messages.at(-1)).toMatchObject({ tokensIn: 1200, tokensOut: 80, tokensCached: 1024, resolvedRefs: { ids: ['A4'], source: 'ui' } });
  });

  it('a design answered in chat becomes a design_note (heuristic in the turn transaction, aux refinement after) — still 2 round-trips', async () => {
    const aux = new DesignAux();
    const context = makeContext(store, aux);
    const id = randomUUID();
    const first = await context.turns.begin({ conversationId: id, question: 'xin chào', images: [], clientHistory: [] });
    await first.finish({ text: 'chào', provider: 'g', model: 'm', mode: 's', durationMs: 1, sources: [] });
    await context.turns.idle();

    pg.resetCounters();
    const turn = await context.turns.begin({ conversationId: id, question: 'thiết kế hệ thống chat realtime', images: [], clientHistory: [] });
    await turn.finish({ text: LONG_DESIGN, provider: 'g', model: 'm', mode: 's', durationMs: 1, sources: [] });
    expect(pg.roundTrips).toBe(2);                                           // read + one transaction (design note inside)
    await context.turns.idle();                                              // background: aux extraction (+1 query, DB awake)

    const note = (await store.load(id, 50, 40))!.artifacts.find((a) => a.kind === ArtifactKind.DESIGN_NOTE)!;
    expect(note).toMatchObject({ owner: 'assistant', label: 'Thiết kế trong chat · Hệ thống chat realtime', dataJson: { extractedBy: 'aux', elements: [{ name: 'WebSocket Gateway', tech: 'Node.js' }, { name: 'Cassandra' }] } });

    // A question about it later resolves to it.
    const later = await context.turns.begin({ conversationId: id, question: 'vì sao dùng Cassandra?', images: [], clientHistory: [] });
    expect(later.resolvedRefs).toMatchObject({ ids: [`A${note.ordinal}`], source: ResolvedRefSource.RULE });
  });

  it('design-note heuristic (no aux): component list / table → elements and decisions', () => {
    expect(isDesignAnswer('thiết kế hệ thống chat', LONG_DESIGN, 800)).toBe(true);
    expect(isDesignAnswer('mutex là gì', LONG_DESIGN, 800)).toBe(false);
    expect(isDesignAnswer('thiết kế hệ thống chat', 'Ngắn gọn.', 800)).toBe(false);
    const table = '| Thành phần | Vai trò |\n|---|---|\n| API Gateway | định tuyến |\n| Redis | cache |';
    expect(isDesignAnswer('kiến trúc thế nào', table, 800)).toBe(true);
    expect(heuristicDesignNote('thiết kế hệ thống chat realtime', LONG_DESIGN)).toMatchObject({
      systemName: 'hệ thống chat realtime',
      elements: [{ name: 'WebSocket Gateway' }, { name: 'Message Service' }, { name: 'Cassandra' }],
      decisions: expect.arrayContaining(['Chọn Cassandra vì ghi nhiều, đọc theo partition.']),
      extractedBy: 'heuristic',
    });
    expect(heuristicDesignNote('kiến trúc', table).elements).toEqual([{ name: 'API Gateway' }, { name: 'Redis' }]);
  });
});

describe('agent tools list_artifacts / get_artifact (note 17 step 8)', () => {
  it('read the snapshot of the current request: list, one level of a spec, its PUML; unknown id; no conversation', async () => {
    const store = new InMemoryConversationStore();
    const context = makeContext(store, null);
    const id = randomUUID();
    await context.c4Recorder.record({ conversationId: id, userText: 'vé', images: [], result: c4Result('Hệ thống đặt vé', ['Booking API']), paused: false });
    const turn = await context.turns.begin({ conversationId: id, question: 'x', images: [], clientHistory: [] });
    const [list, get] = createArtifactTools(() => turn.snapshot);
    expect(list.name).toBe('list_artifacts');
    expect(get.name).toBe('get_artifact');

    const listed = await list.execute({});
    expect(listed.content).toContain('[A1] c4_spec · turn 1 · C4 container · Hệ thống đặt vé · owner assistant · levels container');
    expect(listed.sources).toEqual([]);
    const spec = await get.execute({ id: '[a1]', part: 'spec', level: 'container' });
    expect(spec.content).toContain('Booking API');
    expect((await get.execute({ id: 'A1', part: 'puml' })).content).toContain('@startuml');
    expect((await get.execute({ id: 'A9' })).content).toContain('not found');
    const [noList] = createArtifactTools(() => null);
    expect((await noList.execute({})).content).toContain('no stored conversation');
  });
});
