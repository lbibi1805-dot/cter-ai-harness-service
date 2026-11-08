import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, type PerProvider } from '../../../../../src/modules/ai';
import { C4SketchService } from '../../../../../src/modules/c4';
import type { C4ModelCall, C4SketchRequest, C4SketchSettings } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { C4Level } from '../../../../../src/modules/c4/domain';
import { ConversationC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/conversationC4Session.repository';
import { InMemoryC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { createContextModule, DEFAULT_CONTEXT_SETTINGS } from '../../../../../src/modules/context';
import { ArtifactKind, ConversationService, InMemoryConversationStore, type ConversationStore } from '../../../../../src/modules/conversation-store';
import { IntentRouter, type RouterAuxCall, type RouterAuxModel } from '../../../../../src/modules/routing';
import { buildTestAiConfig, buildTestConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON } from '../../../../support/c4Fixture';
import { FakeObjectStorage } from '../../../../support/countingAdapters';

const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-test', gemini: 'gemini-test', grok: 'grok-test', openai: 'openai-test' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const SETTINGS: C4SketchSettings = { enabled: true, deadlineMs: 60_000, criticCutoffMs: 40_000, callTimeoutMs: 30_000, maxElements: 12 };
const BASE: C4SketchRequest = { provider: AIProvider.GEMINI, description: '', levels: [C4Level.CONTEXT], fast: true, stream: false, images: [] };

function briefOf(systemName: string, confident = true): string {
  const c = confident ? 0.9 : 0;
  return JSON.stringify({ brief: {
    systemName: { value: systemName, confidence: 0.95 }, systemBoundary: { value: confident ? 'Web + API' : '', confidence: c },
    actors: { value: ['Customer'], confidence: 0.9 }, externalSystems: { value: [], confidence: c },
    techConstraints: { value: [], confidence: c }, levels: { value: confident ? ['context'] : [], confidence: c },
  }, typed: {} });
}

function design(systemName: string, extra = ''): string {
  const spec = { ...CONTEXT_SPEC_JSON, title: `${systemName}${extra}` };
  return JSON.stringify({ systemName, requirements: [{ id: 'R1', text: 'Customers book', levels: ['context'] }], diagrams: { context: spec } });
}

/** Model: extraction reads the system name from the request; the architect draws it; revise echoes the base system + "Redis". */
function model() {
  const calls: C4ModelCall[] = [];
  const systemOf = (text: string) => (/giao đồ ăn/i.test(text) ? 'Hệ thống giao đồ ăn' : 'Hệ thống đặt vé');
  return {
    calls,
    steps: () => calls.map((c) => c.label.split('-').slice(3).join('-')),
    gateway: {
      ask: async (call: C4ModelCall) => {
        calls.push(call);
        const step = call.label.split('-').slice(3).join('-');
        if (step === 'extract') return briefOf(systemOf(call.text), !/mơ hồ/.test(call.text));
        if (step === 'architect') return design(systemOf(call.text));
        if (step === 'revise') return design(call.text.includes('"systemName":"Hệ thống giao đồ ăn"') ? 'Hệ thống giao đồ ăn' : 'Hệ thống đặt vé', ' + Redis');
        if (step === 'review') return '## Tóm tắt nhận xét\nỔn.';
        return '{}';
      },
    },
  };
}

function auxModel(answer = '{}'): RouterAuxModel & { calls: RouterAuxCall[] } {
  const calls: RouterAuxCall[] = [];
  return { name: 'fake/aux', calls, complete: async (call) => { calls.push(call); return answer; } };
}

function setup(store: ConversationStore = new InMemoryConversationStore(), aux = auxModel()) {
  const storage = new FakeObjectStorage();
  const conversations = new ConversationService(store, storage);
  const cfg = buildTestConfig();
  const context = createContextModule(
    { settings: DEFAULT_CONTEXT_SETTINGS, aux: cfg.context.aux, timeouts: cfg.context.timeouts, systemPrompt: 'S' },
    { invocation: null as never, store, conversations, isProviderConfigured: () => false, auxModel: null, auxResolver: null },
  );
  const m = model();
  const build = () => new C4SketchService(SETTINGS, {
    catalog: CATALOG,
    sessions: new ConversationC4SessionRepository(new InMemoryC4SessionRepository(), store),
    model: m.gateway,
    knowledge: { search: async () => [] },
    renderer: { render: async () => ({ png: Buffer.from('png') }) },
    puml: { includeBase: 'stdlib' },
    conversations: context.c4Recorder,
    router: new IntentRouter(aux, { timeoutMs: 1500 }),
  });
  return { store, conversations, context, model: m, aux, build, svc: build() };
}

async function specs(store: ConversationStore, conversationId: string) {
  return (await store.load(conversationId, 100, 100))!.artifacts.filter((a) => a.kind === ArtifactKind.C4_SPEC);
}

describe('C4 flow with a conversation (notes 05 + 17 §4)', () => {
  it('budget: a conversation with one design → 0 aux calls for "sửa diagram: thêm Redis cache", and the revision chains to it', async () => {
    const { svc, store, aux, model: m } = setup();
    const conversationId = randomUUID();
    const first = await svc.sketch({ ...BASE, description: 'Hệ thống đặt vé xem phim', conversationId });
    expect(first.artifacts?.map((a) => a.kind)).toEqual(['problem_brief', 'c4_spec', 'c4_png', 'c4_puml']);

    const revised = await svc.sketch({ ...BASE, description: 'sửa diagram: thêm Redis cache', conversationId });
    expect(aux.calls).toHaveLength(0);
    expect(revised.intent).toMatchObject({ intent: 'c4_revise', source: 'rule' });
    expect(m.steps().filter((s) => s === 'revise')).toHaveLength(1);
    const [v1, v2] = await specs(store, conversationId);
    expect(v2).toMatchObject({ parentArtifactId: v1.id, version: 2 });
    expect(revised.revision).toEqual({ parentArtifactId: v1.id, version: 2, baseAlias: `A${v1.ordinal}` });
    expect(m.calls.find((c) => c.label.endsWith('-revise'))!.text).toContain('thêm Redis cache');
  });

  it('revise picks the design the user names among two (not the newest), and refArtifactIds win', async () => {
    const { svc, store, model: m } = setup();
    const conversationId = randomUUID();
    await svc.sketch({ ...BASE, description: 'Hệ thống đặt vé xem phim', conversationId });
    await svc.sketch({ ...BASE, description: 'Hệ thống giao đồ ăn', conversationId });
    const [ticket, food] = await specs(store, conversationId);
    expect([ticket.version, food.version]).toEqual([1, 1]);

    await svc.sketch({ ...BASE, description: 'sửa thiết kế hệ thống đặt vé: thêm Redis cache', conversationId });
    const third = (await specs(store, conversationId))[2];
    expect(third).toMatchObject({ parentArtifactId: ticket.id, version: 2 });
    expect(m.calls.filter((c) => c.label.endsWith('-revise'))[0].text).toContain('"systemName":"Hệ thống đặt vé"');

    await svc.sketch({ ...BASE, description: 'thêm Redis cache', conversationId, refArtifactIds: [`A${food.ordinal}`], intent: undefined });
    const fourth = (await specs(store, conversationId))[3];
    expect(fourth).toMatchObject({ parentArtifactId: food.id, version: 2 });
  });

  it('reviews a design of the conversation (owner signal) and saves a design_review artifact', async () => {
    const { svc, store, model: m } = setup();
    const conversationId = randomUUID();
    await svc.sketch({ ...BASE, description: 'Hệ thống đặt vé xem phim', conversationId });
    const reviewed = await svc.sketch({ ...BASE, description: 'nhận xét thiết kế bạn vẽ lúc nãy', conversationId, fast: false });
    expect(reviewed.intent?.intent).toBe('c4_review');
    expect(m.steps().slice(-2)).toEqual(['extract', 'review']);
    expect(m.calls.at(-1)!.text).toContain('Hệ thống đặt vé');
    expect(reviewed.review).toMatchObject({ designSource: 'c4_spec', alias: expect.stringMatching(/^A\d+$/) });
    const kinds = (await store.load(conversationId, 100, 100))!.artifacts.map((a) => a.kind);
    expect(kinds).toContain(ArtifactKind.DESIGN_REVIEW);
    expect(reviewed.levels).toEqual([]);
  });

  it('pendingC4 survives a restart; monitoring shows step + questions; C4 messages store the intent', async () => {
    const store = new InMemoryConversationStore();
    const before = setup(store);
    const conversationId = randomUUID();
    const paused = await before.svc.sketch({ ...BASE, levels: [], fast: false, description: 'đề mơ hồ về hệ thống đặt vé', conversationId });
    expect(paused.clarify?.questions.length).toBeGreaterThan(0);

    const view = await before.conversations.get(conversationId);
    expect(view.state.pendingC4).toMatchObject({ id: paused.clarify!.sessionId, step: 'clarify', intent: { intent: 'c4_generate' }, questions: paused.clarify!.questions });
    expect(view.state.pendingC4).not.toHaveProperty('knowledge');
    expect((await before.conversations.list(20, false, 'c4')).map((c) => c.id)).toEqual([conversationId]);

    const after = setup(store);                                // new process: empty memory, same database
    const done = await after.svc.resume({ sessionId: paused.clarify!.sessionId, answers: 'ok', stream: false });
    expect(done.levels[0].png).toBeDefined();
    expect(await after.conversations.list(20, false, 'c4')).toEqual([]);
    const messages = (await after.conversations.get(conversationId)).messages;
    expect(messages.map((m) => m.intent)).toEqual(['c4_generate', 'c4_generate', 'c4_generate', 'c4_generate']);
    expect(messages[0].intentConfidence).toBeCloseTo(0.9);
    await expect(after.conversations.list(20, false, 'nope')).rejects.toThrow(/pending/);
  });
});
