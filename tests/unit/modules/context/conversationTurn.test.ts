import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { AIProvider, ModelCatalog, type PromptContent } from '../../../../src/modules/ai';
import { AnswerMode, type Answerer } from '../../../../src/modules/agent/domain';
import { ChatService } from '../../../../src/modules/chat';
import { createContextModule, DEFAULT_CONTEXT_SETTINGS, type AuxCall, type AuxModel, type ContextModule } from '../../../../src/modules/context';
import { ConversationService, InMemoryConversationStore, NeonConversationStore, type ConversationStore } from '../../../../src/modules/conversation-store';
import { NotFoundError } from '../../../../src/shared/errors';
import { FakeObjectStorage, flaky } from '../../../support/countingAdapters';
import { PgliteSqlClient } from '../../../support/pgliteSqlClient';
import { buildTestAiConfig } from '../../../support/configFixture';

const PNG = { data: Buffer.from('fake-png-bytes'), mimeType: 'image/png' };

/** Aux model double: captions images, summarizes, rewrites follow-ups. */
class FakeAux implements AuxModel {
  readonly name = 'fake/aux';
  calls: AuxCall[] = [];
  summary = '🎯 Mục tiêu: ôn thi\n✅ Quyết định: —\n📌 Facts: —\n❓ Câu hỏi mở: —\n🔗 Artifact refs: (none)';
  async complete(call: AuxCall): Promise<string> {
    this.calls.push(call);
    if (call.images?.length) return '```json\n{"caption":"Đề bài hệ thống đặt vé, 5 NFR","ocr_text":"Thiết kế hệ thống đặt vé xem phim"}\n```';
    if (call.system.includes('compact')) return this.summary;
    return 'mutex hoạt động thế nào';
  }
}

function makeChat(store: ConversationStore, settings = DEFAULT_CONTEXT_SETTINGS) {
  const storage = new FakeObjectStorage();
  const conversations = new ConversationService(store, storage);
  const aux = new FakeAux();
  const context: ContextModule = createContextModule(
    { settings, aux: { provider: AIProvider.GEMINI, model: 'aux' }, timeouts: { imageNoteMs: 1000, imageNoteSyncMs: 1000, rewriteMs: 1000, compactMs: 1000 }, systemPrompt: 'STATIC SYSTEM' },
    { invocation: null as never, store, conversations, isProviderConfigured: () => true, auxModel: aux },
  );
  const seen: PromptContent[] = [];
  const answers: Answerer = {
    answer: async (req) => {
      seen.push(req.content);
      req.stream?.delta('a');
      return { text: `answer ${seen.length}`, model: req.model, attempts: 1, contexts: [], mode: AnswerMode.SINGLE_SHOT };
    },
  };
  const chat = new ChatService(answers, new ModelCatalog(buildTestAiConfig()), { enabled: true, agentEnabled: false, isProviderConfigured: () => true, turns: context.turns });
  const ask = async (question: string, conversationId?: string, images = [] as typeof PNG[]) => {
    const result = await chat.ask({ provider: AIProvider.GEMINI, mode: AnswerMode.SINGLE_SHOT, content: { textContent: question, imageBuffers: images, history: [] }, includeTrace: false, stream: true, ...(conversationId ? { conversationId } : {}) }, { delta: () => undefined, reset: () => undefined });
    await context.turns.idle();
    return result;
  };
  return { ask, seen, storage, aux, context, chat };
}

let pg: PgliteSqlClient;
beforeAll(async () => { pg = new PgliteSqlClient(); });
afterAll(async () => { await pg.close(); });

describe('chat with server-side memory (notes 03 + 04)', () => {
  let store: NeonConversationStore;
  beforeEach(async () => {
    await pg.db.exec('DROP TABLE IF EXISTS artifacts; DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS conversations;');
    store = new NeonConversationStore(pg);
  }, 60_000); // PGlite boots its WASM on the first query

  it('turn 1 image → turn 2 other topic → turn 3 "đề lúc nãy": the image comes back, with its OCR in the RAG query', async () => {
    const c = makeChat(store);
    const t1 = await c.ask('Đây là đề', undefined, [PNG]);
    const id = t1.conversation!.conversationId;
    expect(t1.conversation).toMatchObject({ persisted: true });
    expect(c.storage.keys(`conversations/${id}/`)).toHaveLength(1);
    const snap1 = (await store.load(id, 50, 40))!;
    expect(snap1.artifacts[0]).toMatchObject({ kind: 'user_image', caption: 'Đề bài hệ thống đặt vé, 5 NFR', ocrText: 'Thiết kế hệ thống đặt vé xem phim' });

    await c.ask('mutex là gì', id);
    expect(c.seen[1].history).toEqual([
      { role: 'user', text: 'Đây là đề\n[ảnh đính kèm: A1 — Đề bài hệ thống đặt vé, 5 NFR]' },
      { role: 'assistant', text: 'answer 1' },
    ]);
    expect(c.seen[1].memory).toContain('[A1] user_image · turn 1 · "Đề bài hệ thống đặt vé, 5 NFR"');

    await c.ask('hỏi thêm về lock', id);
    await c.ask('đề lúc nãy yêu cầu gì?', id);
    const t4 = c.seen[3];
    expect(t4.imageBuffers).toHaveLength(1);
    expect(t4.imageBuffers[0].data.equals(PNG.data)).toBe(true);
    expect(t4.jitContext).toContain('#1 = [A1] user_image');
    expect(t4.retrievalQuery).toContain('Thiết kế hệ thống đặt vé xem phim');
    expect(t4.history).toHaveLength(6);
  });

  it('budget: a turn on an existing conversation = 2 database round-trips (1 read + 1 transaction)', async () => {
    const c = makeChat(store);
    const id = (await c.ask('q1')).conversation!.conversationId;      // schema + maintenance happen here
    await c.ask('q2', id);
    pg.resetCounters();
    await c.ask('q3', id);
    expect(pg.roundTrips).toBe(2);

    pg.resetCounters();
    await c.ask('new conversation');                                         // no id: nothing to read
    expect(pg.roundTrips).toBe(1);
  });

  it('a soft-deleted conversation answers 404; an unknown id simply starts with that id', async () => {
    const c = makeChat(store);
    const id = (await c.ask('q1')).conversation!.conversationId;
    await store.softDelete(id, 30);
    await expect(c.ask('q2', id)).rejects.toBeInstanceOf(NotFoundError);
    const fresh = randomUUID();
    expect((await c.ask('hello', fresh)).conversation?.conversationId).toBe(fresh);
    await expect(c.ask('x', 'not-a-uuid')).rejects.toThrow('UUID');
  });

  it('a pronoun follow-up gets a standalone RAG query from the aux model', async () => {
    const c = makeChat(store);
    const id = (await c.ask('mutex là gì')).conversation!.conversationId;
    await c.ask('giải thích nó kỹ hơn', id);
    expect(c.seen[1].retrievalQuery).toBe('mutex hoạt động thế nào');
    expect(c.seen[1].textContent).toBe('giải thích nó kỹ hơn');
  });

  it('an image-only question is OCR\'d first so RAG has something to search', async () => {
    const c = makeChat(store);
    await c.ask('', undefined, [PNG]);
    expect(c.seen[0].retrievalQuery).toBe('Thiết kế hệ thống đặt vé xem phim');
  });

  it('auto-compact: long conversations get a rolling summary that keeps every artifact id; recent turns stay verbatim', async () => {
    const c = makeChat(store, { ...DEFAULT_CONTEXT_SETTINGS, compactMaxTurns: 3, keepRecentTurns: 2 });
    const id = (await c.ask('đề', undefined, [PNG])).conversation!.conversationId;
    for (let i = 2; i <= 4; i++) await c.ask(`câu ${i}`, id);

    const snap = (await store.load(id, 50, 40))!;
    expect(snap.summary).toContain('🎯 Mục tiêu');
    expect(snap.summary).toContain('A1');                                   // appended: the aux summary forgot it
    expect(snap.summaryUptoSeq).toBe(4);
    expect(snap.messages.map((m) => m.seq)).toEqual([5, 6, 7, 8]);

    await c.ask('câu 5', id);
    const last = c.seen.at(-1)!;
    expect(last.memory).toContain('### Summary of earlier turns');
    expect(last.history!.map((t) => t.text)).toEqual(['câu 3', 'answer 3', 'câu 4', 'answer 4']);
    expect(c.aux.calls.filter((call) => call.system.includes('compact'))).toHaveLength(1);
  });
});

describe('chat memory degrades gracefully when the database fails', () => {
  it('load fails → client history is used; write fails → answer still returned (persisted=false)', async () => {
    const inner = flaky(new InMemoryConversationStore());
    const c = makeChat(inner.proxy);
    const id = (await c.ask('q1')).conversation!.conversationId;

    inner.failNext('load');
    const r = await c.chat.ask({
      provider: AIProvider.GEMINI, mode: AnswerMode.SINGLE_SHOT, includeTrace: false, stream: false, conversationId: id,
      content: { textContent: 'q2', imageBuffers: [], history: [{ role: 'user' as never, text: 'from client' }, { role: 'assistant' as never, text: 'ok' }] },
    });
    expect(c.seen[1].history?.[0].text).toBe('from client');
    expect(r.conversation?.persisted).toBe(true);

    inner.failNext('recordTurn');
    const failed = await c.ask('q3', id);
    expect(failed.answer.text).toBe('answer 3');
    expect(failed.conversation).toMatchObject({ conversationId: id, persisted: false });
  });

  it('without the store the chat stays stateless (client history, no conversationId)', async () => {
    const seen: PromptContent[] = [];
    const chat = new ChatService(
      { answer: async (req) => { seen.push(req.content); return { text: 't', model: req.model, attempts: 1, contexts: [] }; } },
      new ModelCatalog(buildTestAiConfig()),
      { enabled: true, agentEnabled: false, isProviderConfigured: () => true },
    );
    const r = await chat.ask({ provider: AIProvider.GEMINI, mode: AnswerMode.SINGLE_SHOT, includeTrace: false, stream: false, conversationId: randomUUID(), content: { textContent: 'q', imageBuffers: [], history: [] } });
    expect(r.conversation).toBeUndefined();
    expect(chat.status().conversations).toBe(false);
  });
});
