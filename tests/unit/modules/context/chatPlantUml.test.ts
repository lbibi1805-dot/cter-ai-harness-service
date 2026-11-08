import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { AIProvider, ModelCatalog } from '../../../../src/modules/ai';
import { AnswerMode } from '../../../../src/modules/agent/domain';
import { ChatService } from '../../../../src/modules/chat';
import type { C4SketchResult } from '../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { C4Level } from '../../../../src/modules/c4/domain';
import { createContextModule, DEFAULT_CONTEXT_SETTINGS } from '../../../../src/modules/context';
import { ArtifactKind, ConversationService, InMemoryConversationStore, MessageRole, type StoredArtifact } from '../../../../src/modules/conversation-store';
import { chatPlantUmlArtifacts } from '../../../../src/modules/context/domain/chatPlantUml';
import { FakeObjectStorage } from '../../../support/countingAdapters';
import { buildTestAiConfig, buildTestConfig } from '../../../support/configFixture';

const FENCE = '```';
const PUML_V1 = '@startuml\n!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml\nContainer(api, "API")\n@enduml';
const PUML_V2 = PUML_V1.replace('Container(api, "API")', 'Container(api, "API")\nContainerDb(db, "DB")');

function stored(over: Partial<StoredArtifact>): StoredArtifact {
  return { id: 'a1', ordinal: 1, kind: ArtifactKind.C4_SPEC, messageId: 'm1', messageSeq: 2, objectKey: null, mime: null, caption: null, ocrText: null, dataJson: null, version: 1, ...over };
}

describe('chatPlantUmlArtifacts', () => {
  it('returns nothing for an answer without PlantUML', () => {
    expect(chatPlantUmlArtifacts(`Chỉ là văn bản.\n${FENCE}js\nx\n${FENCE}`)).toEqual([]);
  });

  it('records a fenced block as a c4_puml of the assistant message, level from the include', () => {
    const [artifact, ...rest] = chatPlantUmlArtifacts(`Đã sửa:\n${FENCE}plantuml\n${PUML_V2}\n${FENCE}\n- thêm DB`);
    expect(rest).toEqual([]);
    expect(artifact).toMatchObject({ kind: ArtifactKind.C4_PUML, owner: MessageRole.ASSISTANT, mime: 'text/plain', level: 'container', dataJson: { puml: PUML_V2, level: 'container' } });
    expect(artifact.bytes?.toString('utf-8')).toBe(PUML_V2);
    expect(artifact.version).toBeUndefined();
  });

  it('records a bare block too, and dedupes identical blocks', () => {
    expect(chatPlantUmlArtifacts(`${PUML_V2}\n\nlại:\n\n${FENCE}puml\n${PUML_V2}\n${FENCE}`)).toHaveLength(1);
  });

  it('continues the picked design: version = base + 1, system name of the spec', () => {
    const spec = stored({ id: 'spec2', version: 2, dataJson: { systemName: 'Đặt vé', levels: [{ level: 'container' }] } });
    const puml = stored({ id: 'puml2', kind: ArtifactKind.C4_PUML, version: 2, level: 'container', dataJson: { level: 'container', puml: PUML_V1 } });
    const [artifact] = chatPlantUmlArtifacts(`${FENCE}plantuml\n${PUML_V2}\n${FENCE}`, [spec, puml]);
    expect(artifact).toMatchObject({ version: 3, parentArtifactId: 'spec2', systemName: 'Đặt vé' });
  });

  it('skips an unchanged echo of the picked PUML', () => {
    const puml = stored({ kind: ArtifactKind.C4_PUML, dataJson: { level: 'container', puml: PUML_V1 } });
    expect(chatPlantUmlArtifacts(`${FENCE}plantuml\n${PUML_V1}\n${FENCE}`, [puml])).toEqual([]);
  });

  it('takes the level of a single picked base when the source has no C4 include', () => {
    const puml = stored({ kind: ArtifactKind.C4_PUML, level: 'component', dataJson: { level: 'component', puml: PUML_V1 } });
    const [artifact] = chatPlantUmlArtifacts(`${FENCE}plantuml\nA -> B\n${FENCE}`, [puml]);
    expect(artifact).toMatchObject({ level: 'component', version: 2, dataJson: { puml: '@startuml\nA -> B\n@enduml', level: 'component' } });
  });
});

describe('a diagram edited in chat becomes a c4_puml artifact', () => {
  it('fences the bare block in the answer and stores it on the assistant message, continuing the design', async () => {
    const store = new InMemoryConversationStore();
    const conversations = new ConversationService(store, new FakeObjectStorage());
    const cfg = buildTestConfig();
    const context = createContextModule(
      { settings: DEFAULT_CONTEXT_SETTINGS, aux: cfg.context.aux, timeouts: cfg.context.timeouts, systemPrompt: 'S' },
      { invocation: null as never, store, conversations, isProviderConfigured: () => false, auxModel: null },
    );
    const conversationId = randomUUID();
    const result: C4SketchResult = {
      provider: AIProvider.GEMINI, model: 'gemini-x', systemName: 'Ticketing', requirements: [], knowledgeSources: [], elapsedMs: 1, deadlineHit: false,
      levels: [{
        level: C4Level.CONTAINER, title: 'Containers', png: Buffer.from('png'), puml: PUML_V1,
        spec: { title: 'Containers', elements: [], rels: [] }, elementCount: 0, covered: [], missing: [], notes: [],
      }],
    };
    await context.c4Recorder.record({ conversationId, userText: 'Hệ thống đặt vé', images: [], result, paused: false });

    const chat = new ChatService(
      { answer: async (req) => ({ text: `Đã sửa:\n\n${PUML_V2}\n\n- thêm DB`, model: req.model, attempts: 1, contexts: [] }) },
      new ModelCatalog(buildTestAiConfig()),
      { enabled: true, agentEnabled: false, isProviderConfigured: () => true, turns: context.turns },
    );
    const answered = await chat.ask({ provider: AIProvider.GEMINI, mode: AnswerMode.SINGLE_SHOT, includeTrace: false, stream: false, conversationId, content: { textContent: 'sửa sơ đồ container ở trên, thêm database', imageBuffers: [], history: [] } });
    expect(answered.answer.text).toContain(`${FENCE}plantuml\n${PUML_V2}\n${FENCE}`);

    const snap = (await store.load(conversationId, 50, 40))!;
    const pumls = snap.artifacts.filter((a) => a.kind === ArtifactKind.C4_PUML);
    expect(pumls).toHaveLength(2);
    expect(pumls[1]).toMatchObject({ owner: MessageRole.ASSISTANT, level: 'container', dataJson: { puml: PUML_V2, level: 'container' } });
    expect(pumls[1].messageId).toBe(snap.messages[3].id);
    expect(pumls[1].version).toBe(2);
  });
});
