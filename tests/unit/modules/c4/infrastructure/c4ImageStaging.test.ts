import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, type PerProvider, type PromptImage } from '../../../../../src/modules/ai';
import { C4_PENDING_IMAGE_PREFIX, C4SketchService, ObjectStorageC4ImageStaging } from '../../../../../src/modules/c4';
import type { C4ModelCall, C4SketchRequest, C4SketchSettings } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { C4Level } from '../../../../../src/modules/c4/domain';
import { ConversationC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/conversationC4Session.repository';
import { InMemoryC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { ConversationStateKey, InMemoryConversationStore, type ConversationStore } from '../../../../../src/modules/conversation-store';
import { buildTestAiConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON } from '../../../../support/c4Fixture';
import { FakeObjectStorage } from '../../../../support/countingAdapters';

const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-test', gemini: 'gemini-test', grok: 'grok-test', openai: 'openai-test' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const SETTINGS: C4SketchSettings = { enabled: true, deadlineMs: 60_000, criticCutoffMs: 40_000, callTimeoutMs: 30_000, maxElements: 12 };
const IMAGES: PromptImage[] = [
  { data: Buffer.from('statement-page-1'), mimeType: 'image/png' },
  { data: Buffer.from('statement-page-2'), mimeType: 'image/jpeg' },
];
const REQUEST: C4SketchRequest = { provider: AIProvider.GEMINI, description: 'đề mơ hồ về hệ thống đặt vé', levels: [], fast: false, stream: false, images: IMAGES };

/** Extract leaves gaps (→ clarify); the architect draws only context, so the drafter runs for the other levels. */
function model() {
  const calls: C4ModelCall[] = [];
  const brief = JSON.stringify({ brief: {
    systemName: { value: 'Hệ thống đặt vé', confidence: 0.95 }, systemBoundary: { value: '', confidence: 0 },
    actors: { value: ['Customer'], confidence: 0.9 }, externalSystems: { value: [], confidence: 0 },
    techConstraints: { value: [], confidence: 0 }, levels: { value: ['context', 'container'], confidence: 0.9 },
  }, typed: {} });
  return {
    calls,
    step: (c: C4ModelCall) => c.label.split('-').slice(3).join('-'),
    gateway: {
      ask: async (call: C4ModelCall) => {
        calls.push(call);
        const step = call.label.split('-').slice(3).join('-');
        if (step === 'extract') return brief;
        if (step === 'architect') {
          return JSON.stringify({ systemName: 'Hệ thống đặt vé', requirements: [{ id: 'R1', text: 'Customers book', levels: ['context'] }], diagrams: { context: CONTEXT_SPEC_JSON } });
        }
        if (step.startsWith('draft')) return JSON.stringify({ ...CONTEXT_SPEC_JSON, title: 'container' });
        return '{}';
      },
    },
  };
}

function service(store: ConversationStore, storage: FakeObjectStorage, m: ReturnType<typeof model>, now: () => number = Date.now) {
  return new C4SketchService(SETTINGS, {
    catalog: CATALOG,
    sessions: new ConversationC4SessionRepository(new InMemoryC4SessionRepository(now), store, now, new ObjectStorageC4ImageStaging(storage)),
    model: m.gateway,
    knowledge: { search: async () => [] },
    renderer: { render: async () => ({ png: Buffer.from('png') }) },
    puml: { includeBase: 'stdlib' },
    now,
  });
}

function staged(storage: FakeObjectStorage): string[] {
  return [...storage.objects.keys()].filter((k) => k.startsWith(C4_PENDING_IMAGE_PREFIX));
}

/** Counts the database writes of the store (setState / takeStateById). */
function countingStore(): InMemoryConversationStore & { writes: string[] } {
  const store = new InMemoryConversationStore() as InMemoryConversationStore & { writes: string[] };
  store.writes = [];
  const setState = store.setState.bind(store);
  store.setState = async (...args: Parameters<typeof setState>) => { store.writes.push('setState'); return setState(...args); };
  return store;
}

describe('/c4 pause → restart → resume keeps the request images', () => {
  it('stages the images on pause (same single state write) and sends them to architect / drafter after a restart', async () => {
    const store = countingStore();
    const storage = new FakeObjectStorage();
    const conversationId = randomUUID();
    const before = model();
    const paused = await service(store, storage, before).sketch({ ...REQUEST, conversationId });
    expect(paused.clarify?.questions.length).toBeGreaterThan(0);
    expect(before.calls.find((c) => before.step(c) === 'extract')!.images).toHaveLength(2);

    expect(store.writes).toEqual(['setState']);
    expect(staged(storage)).toHaveLength(2);
    const pending = (await store.findActive(conversationId, 10))!.state[ConversationStateKey.PENDING_C4] as Record<string, unknown>;
    expect(pending.imageKeys).toEqual([
      { key: `${C4_PENDING_IMAGE_PREFIX}${paused.clarify!.sessionId}/0.png`, mime: 'image/png' },
      { key: `${C4_PENDING_IMAGE_PREFIX}${paused.clarify!.sessionId}/1.jpg`, mime: 'image/jpeg' },
    ]);
    expect((pending.request as Record<string, unknown>).images).toEqual([]);

    // Restart: a new service instance with empty memory, same database and bucket.
    const after = model();
    const done = await service(store, storage, after).resume({ sessionId: paused.clarify!.sessionId, answers: 'ok', stream: false });
    expect(done.levels.some((l) => l.png)).toBe(true);
    const architect = after.calls.find((c) => after.step(c) === 'architect')!;
    expect(architect.images.map((i) => i.data.toString())).toEqual(['statement-page-1', 'statement-page-2']);
    expect(architect.images.map((i) => i.mimeType)).toEqual(['image/png', 'image/jpeg']);
    const draft = after.calls.find((c) => after.step(c).startsWith('draft'));
    expect(draft?.images).toHaveLength(2);
    expect(staged(storage)).toEqual([]);
  });

  it('resume in the same process uses the RAM copy and still cleans the staged objects', async () => {
    const store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    const m = model();
    const svc = service(store, storage, m);
    const paused = await svc.sketch({ ...REQUEST, conversationId: randomUUID() });
    expect(staged(storage)).toHaveLength(2);
    await svc.resume({ sessionId: paused.clarify!.sessionId, answers: 'ok', stream: false });
    expect(m.calls.find((c) => m.step(c) === 'architect')!.images).toHaveLength(2);
    expect(staged(storage)).toEqual([]);
  });

  it('an expired session found on the request path deletes its staged images', async () => {
    let clock = 1_000_000;
    const store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    const paused = await service(store, storage, model(), () => clock).sketch({ ...REQUEST, conversationId: randomUUID() });
    clock += 16 * 60_000;
    await expect(service(store, storage, model(), () => clock).resume({ sessionId: paused.clarify!.sessionId, answers: 'ok', stream: false })).rejects.toThrow(/expired/);
    expect(staged(storage)).toEqual([]);
  });

  it('missing staged objects → resume from the brief only (no failure)', async () => {
    const store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    const paused = await service(store, storage, model()).sketch({ ...REQUEST, conversationId: randomUUID() });
    storage.objects.clear();
    const after = model();
    const done = await service(store, storage, after).resume({ sessionId: paused.clarify!.sessionId, answers: 'ok', stream: false });
    expect(done.levels.length).toBeGreaterThan(0);
    expect(after.calls.find((c) => after.step(c) === 'architect')!.images).toEqual([]);
  });

  it('a staging failure keeps the pause working (images only in RAM)', async () => {
    const store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    storage.faults.failNext('put', 2);
    const conversationId = randomUUID();
    const paused = await service(store, storage, model()).sketch({ ...REQUEST, conversationId });
    expect(paused.clarify?.sessionId).toBeDefined();
    const pending = (await store.findActive(conversationId, 10))!.state[ConversationStateKey.PENDING_C4] as Record<string, unknown>;
    expect(pending.imageKeys).toBeUndefined();
  });

  it('every C4 model call carries its step deadline (C4_CALL_TIMEOUT_MS within the run), not the chat default', async () => {
    const clock = 5_000_000;
    const m = model();
    await service(new InMemoryConversationStore(), new FakeObjectStorage(), m, () => clock).sketch({ ...REQUEST, conversationId: randomUUID() });
    expect(m.calls.length).toBeGreaterThan(0);
    for (const call of m.calls) expect(call.deadlineAt).toBe(clock + SETTINGS.callTimeoutMs);
  });
});
