import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import { AIProvider, ModelCatalog, type PromptContent } from '../../../../src/modules/ai';
import { AnswerMode } from '../../../../src/modules/agent/domain';
import { ChatService } from '../../../../src/modules/chat';
import type { C4Session, C4SketchResult } from '../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { ConversationC4SessionRepository } from '../../../../src/modules/c4/infrastructure/conversationC4Session.repository';
import { InMemoryC4SessionRepository } from '../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { BriefSource, C4Level, C4WorkflowStep, emptyBrief } from '../../../../src/modules/c4/domain';
import { IntentSource, RequestIntent } from '../../../../src/modules/routing';
import { createContextModule, DEFAULT_CONTEXT_SETTINGS } from '../../../../src/modules/context';
import { ConversationService, InMemoryConversationStore } from '../../../../src/modules/conversation-store';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { buildTestConfig, buildTestAiConfig } from '../../../support/configFixture';

const REQUEST = { provider: AIProvider.GEMINI, description: 'Hệ thống đặt vé', levels: [], fast: false, stream: false, images: [] };

function session(conversationId: string | undefined, expiresAt = 10_000): C4Session {
  const brief = { ...emptyBrief(), systemName: { value: 'Ticketing', confidence: 0.9, source: BriefSource.IMAGE } };
  return {
    id: randomUUID(), step: C4WorkflowStep.CLARIFY, request: { ...REQUEST, conversationId }, model: 'm', knowledge: [], remainingMs: 1000, activeMs: 5, expiresAt, label: 'c4-x', conversationId,
    intent: { intent: RequestIntent.C4_GENERATE, confidence: 0.9, source: IntentSource.RULE }, intentConfidence: 0.9, brief, systemName: 'Ticketing', summary: [], questions: [],
  };
}

describe('C4 sessions survive a restart (conversations.state.pendingC4)', () => {
  it('a new process (empty memory) still resumes a paused run of a conversation', async () => {
    const store = new InMemoryConversationStore();
    const before = new ConversationC4SessionRepository(new InMemoryC4SessionRepository(() => 0), store, () => 0);
    const conversationId = randomUUID();
    const s = session(conversationId);
    await before.save(s);

    const afterRestart = new ConversationC4SessionRepository(new InMemoryC4SessionRepository(() => 0), store, () => 0);
    const resumed = await afterRestart.take(s.id);
    expect(resumed).toMatchObject({ id: s.id, conversationId, step: 'clarify', brief: { systemName: { value: 'Ticketing' } } });
    expect(await afterRestart.take(s.id)).toBeUndefined();                    // taken once
  });

  it('expired persisted sessions are not resumed; sessions without a conversation stay in memory', async () => {
    const store = new InMemoryConversationStore();
    let clock = 0;
    const repo = new ConversationC4SessionRepository(new InMemoryC4SessionRepository(() => clock), store, () => clock);
    const s = session(randomUUID(), 100);
    await repo.save(s);
    clock = 200;
    const fresh = new ConversationC4SessionRepository(new InMemoryC4SessionRepository(() => clock), store, () => clock);
    expect(await fresh.take(s.id)).toBeUndefined();

    const local = session(undefined);
    await repo.save(local);
    clock = 0;
    expect((await repo.take(local.id))?.id).toBe(local.id);
  });
});

describe('a C4 run becomes conversation memory', () => {
  it('stores PNG/PUML/spec artifacts and a text summary; a later design question inlines the spec', async () => {
    const store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    const conversations = new ConversationService(store, storage);
    const cfg = buildTestConfig();
    const context = createContextModule(
      { settings: DEFAULT_CONTEXT_SETTINGS, aux: cfg.context.aux, timeouts: cfg.context.timeouts, systemPrompt: 'S' },
      { invocation: null as never, store, conversations, isProviderConfigured: () => false, auxModel: null },
    );
    const conversationId = randomUUID();
    const result: C4SketchResult = {
      provider: AIProvider.GEMINI, model: 'gemini-x', systemName: 'Ticketing', requirements: [{ id: 'R1', text: 'Thanh toán VNPay', levels: [] }],
      knowledgeSources: [], elapsedMs: 1234, deadlineHit: false,
      levels: [{
        level: C4Level.CONTAINER, title: 'Containers', png: Buffer.from('png'), puml: '@startuml\nContainer(mq, "Message Queue", "RabbitMQ")\n@enduml',
        spec: { title: 'Containers', elements: [{ id: 'mq', kind: 'container' as never, variant: 'queue' as never, external: false, name: 'Message Queue', desc: 'async booking', tech: 'RabbitMQ', covers: ['R1'] }], rels: [] },
        elementCount: 1, covered: ['R1'], missing: [], notes: [],
      }],
    };
    await context.c4Recorder.record({ conversationId, userText: 'Hệ thống đặt vé', images: [], result, paused: false });

    const snap = (await store.load(conversationId, 50, 40))!;
    expect(snap.messages.map((m) => m.kind)).toEqual(['c4', 'c4']);
    expect(snap.messages[1].text).toContain('Message Queue [RabbitMQ]');
    expect(snap.artifacts.map((a) => a.kind)).toEqual(['c4_spec', 'c4_png', 'c4_puml']);
    expect(storage.keys(`conversations/${conversationId}/`)).toHaveLength(2);   // png + puml files

    const seen: PromptContent[] = [];
    const chat = new ChatService(
      { answer: async (req) => { seen.push(req.content); return { text: 'vì cần xử lý bất đồng bộ', model: req.model, attempts: 1, contexts: [] }; } },
      new ModelCatalog(buildTestAiConfig()),
      { enabled: true, agentEnabled: false, isProviderConfigured: () => true, turns: context.turns },
    );
    await chat.ask({ provider: AIProvider.GEMINI, mode: AnswerMode.SINGLE_SHOT, includeTrace: false, stream: false, conversationId, content: { textContent: 'vì sao dùng message queue?', imageBuffers: [], history: [] } });
    expect(seen[0].jitContext).toContain('c4_spec');
    expect(seen[0].jitContext).toContain('RabbitMQ');
    expect(seen[0].history?.[1].text).toContain('Đã vẽ C4 cho "Ticketing"');
  });
});
