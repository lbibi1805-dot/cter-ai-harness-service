import { describe, it, expect } from 'vitest';
import { createHash, randomUUID } from 'crypto';
import { AIProvider, PromptPreparer, RagAvailability, type PromptContent } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import { CONVERSATION_MEMORY_ANCHOR, CONVERSATION_SOURCE_RULE, DIAGRAM_EDIT_RULE } from '../../../../src/modules/ai/domain/constants/promptLayers.constants';
import { placeMemory } from '../../../../src/modules/ai/domain/helpers/promptLayers.helper';
import { DEFAULT_CONTEXT_SETTINGS, createContextModule, staticPrefixOf, promptVersionOf } from '../../../../src/modules/context';
import { ConversationService, InMemoryConversationStore } from '../../../../src/modules/conversation-store';
import { CitationPromptBuilder } from '../../../../src/modules/retrieval';
import { CITATION_RULES } from '../../../../src/modules/retrieval/application/constants/citationPrompt.constants';
import { FakeObjectStorage } from '../../../support/countingAdapters';

const BASE = 'BASE SYSTEM PROMPT';

function ragReady(): RagAvailability {
  const rag = new RagAvailability();
  rag.markReady({ retriever: { retrieve: async (q: string) => [{ chunkId: 'c', text: `ctx for ${q}`, source: 's.md', heading: 'H', parentHeading: '', tokenCount: 1, score: 0.9 }] }, builder: new CitationPromptBuilder() });
  return rag;
}

function conversationContent(n: number): PromptContent {
  return {
    textContent: `question ${n}`,
    imageBuffers: [],
    history: [{ role: 'user' as never, text: `[SUMMARY OF EARLIER TURNS]\nsummary ${n}` }, { role: 'assistant' as never, text: 'ack' }],
    jitContext: `## CONVERSATION MEMORY\n[A${n}] c4_spec · turn ${n}\n\n[CONVERSATION ARTIFACTS] jit ${n}`,
  };
}

describe('PROMPT_CACHE_LAYOUT=v2 (note 18 §4, §7)', () => {
  it('the system prompt is byte-identical for two different conversations, on the RAG and the knowledge.md path alike', async () => {
    const rag = new PromptPreparer(BASE, 'KB', ragReady());
    const fallback = new PromptPreparer(BASE, 'KB', new RagAvailability());
    const prompts = await Promise.all([
      rag.prepare(conversationContent(1)), rag.prepare(conversationContent(2)),
      fallback.prepare(conversationContent(1)), fallback.prepare(conversationContent(2)),
      fallback.prepare({ textContent: 'stateless', imageBuffers: [] }),
    ]);
    const systems = new Set(prompts.map((p) => p.systemPrompt));
    expect(systems.size).toBe(1);
    const [system] = systems;
    expect(system).toBe(`${BASE}\n\n${CITATION_RULES}\n\n${CONVERSATION_SOURCE_RULE}\n${CONVERSATION_MEMORY_ANCHOR}\n${DIAGRAM_EDIT_RULE}`);
    expect(DIAGRAM_EDIT_RULE).toContain('```plantuml');
    expect(system).toBe(staticPrefixOf(BASE, PromptCacheLayout.V2));
    expect(CONVERSATION_SOURCE_RULE).toContain('Dựa trên [A7]');
  });

  it('tail order: ③ registry → ⑤ JIT → ⑥ RAG → ⑦ question; a legacy `memory` goes to the tail, never to the system prompt', async () => {
    const prepared = await new PromptPreparer(BASE, '', ragReady()).prepare({ ...conversationContent(1), memory: 'LEGACY MEMORY', retrievalQuery: 'Q' });
    const user = prepared.content.textContent;
    const order = ['LEGACY MEMORY', '## CONVERSATION MEMORY', 'jit 1', 'ctx for Q', 'question 1'].map((x) => user.indexOf(x));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(prepared.systemPrompt).not.toContain('LEGACY MEMORY');
    expect(prepared.systemPrompt).not.toContain('[A1]');
    expect(placeMemory('S', { textContent: 'q', imageBuffers: [], memory: 'M' }, PromptCacheLayout.V1).systemPrompt).toBe('S\n\nM');
  });

  it('prefix ①② (system + summary turn) hashes the same at turn n and n+1 without compaction; ④ history only grows', async () => {
    const store = new InMemoryConversationStore();
    const conversations = new ConversationService(store, new FakeObjectStorage());
    const context = createContextModule(
      { settings: DEFAULT_CONTEXT_SETTINGS, aux: { provider: AIProvider.GEMINI, model: 'aux' }, timeouts: { imageNoteMs: 1, imageNoteSyncMs: 1, rewriteMs: 1, compactMs: 1 }, systemPrompt: BASE },
      { invocation: null as never, store, conversations, isProviderConfigured: () => false, auxModel: null },
    );
    expect(context.promptVersion).toBe(promptVersionOf(staticPrefixOf(BASE, PromptCacheLayout.V2)));
    const id = randomUUID();
    const first = await context.turns.begin({ conversationId: id, question: 'q1', images: [], clientHistory: [] });
    await first.finish({ text: 'a1', provider: 'g', model: 'm', mode: 's', durationMs: 1, sources: [] });
    await store.saveSummary(id, 'Mục tiêu: ôn C4 (A1)', 0, 0);

    const preparer = new PromptPreparer(BASE, 'KB', ragReady());
    const prefixes: string[] = [];
    const histories: string[][] = [];
    for (const q of ['câu n', 'câu n+1']) {
      const turn = await context.turns.begin({ conversationId: id, question: q, images: [], clientHistory: [] });
      const prepared = await preparer.prepare(turn.content);
      const history = prepared.content.history ?? [];
      prefixes.push(createHash('sha256').update(prepared.systemPrompt).update(JSON.stringify(history.slice(0, 2))).digest('hex'));
      histories.push(history.map((t) => `${t.role}:${t.text}`));
      expect(prepared.systemPrompt).not.toContain('Mục tiêu');
      expect(history[0].text).toContain('[SUMMARY OF EARLIER TURNS]');
      await turn.finish({ text: `answer to ${q}`, provider: 'g', model: 'm', mode: 's', durationMs: 1, sources: [] });
      await context.turns.idle();
    }
    expect(prefixes[0]).toBe(prefixes[1]);
    expect(histories[1].slice(0, histories[0].length)).toEqual(histories[0]);
  });
});
