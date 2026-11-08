import path from 'path';
import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, type AIAnswer, type AIRequest, type PreparedPrompt } from '../../../../src/modules/ai';
import { PromptCacheLayout } from '../../../../src/modules/ai/domain/enums/promptLayout.enums';
import { ChatService, type ChatTurns } from '../../../../src/modules/chat';
import { toChatQuestion } from '../../../../src/modules/chat/presentation/mappers/chat.mapper';
import type { Answerer } from '../../../../src/modules/agent/domain';
import {
  DEFAULT_ESSAY_SETTINGS,
  EssayCallPurpose,
  EssayService,
  EssayTrigger,
  EssayVerb,
  LLM_CALL_BUDGET,
  parseAnalysisObject,
  type EssayAnalysisSource,
  type EssayServiceDeps,
} from '../../../../src/modules/essay';
import { createPromptRegistry } from '../../../../src/modules/prompts';
import type { CandidateReranker, CitedChunk } from '../../../../src/modules/retrieval';
import {
  IntentRouter,
  parseAuxRouteReply,
  ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS,
  ROUTER_AUX_MAX_OUTPUT_TOKENS,
  ROUTER_ESSAY_INSTRUCTIONS,
  ROUTER_ESSAY_SKILL_ID,
  type RouterAuxCall,
  type RouterAuxModel,
} from '../../../../src/modules/routing';
import { buildTestAiConfig } from '../../../support/configFixture';

const QUESTION = 'Định nghĩa black-box testing, định nghĩa white-box testing; nêu ưu nhược điểm (2 điểm)';
const ESSAY_BLOCK = { subject: 'Kiểm thử phần mềm', aspects: ['black-box testing', 'white-box testing'], verbs: ['explain', 'compare'], points: 2, targetWords: null };
const GOOD_REPLY = JSON.stringify({ intent: 'qa', confidence: 0.9, refs: [], essay: ESSAY_BLOCK });
const WRITE_REPLY = '<outline>- BB [c:q#1#000]</outline>\n<essay>Bài viết.</essay>';

function auxModel(answer: string | (() => Promise<string>)): RouterAuxModel & { calls: RouterAuxCall[] } {
  const calls: RouterAuxCall[] = [];
  return {
    name: 'fake/aux',
    calls,
    complete: async (call) => {
      calls.push(call);
      return typeof answer === 'string' ? answer : answer();
    },
  };
}

function chunk(id: string): CitedChunk {
  return { chunkId: id, text: `text of ${id}`, source: 'course/week1.md', heading: 'H', parentHeading: '', tokenCount: 10 };
}

const noRerank: CandidateReranker = { enabled: false, candidateCount: (k) => k, wrap: (inner) => inner };

function essayService(ownAux = true) {
  const calls: { request: AIRequest; prompt: PreparedPrompt }[] = [];
  const deps: EssayServiceDeps = {
    invocation: {
      answerPrepared: async (request, prompt) => {
        calls.push({ request, prompt });
        const text = request.purpose === EssayCallPurpose.WRITE ? WRITE_REPLY : JSON.stringify({ subject: 'own', aspects: ['own aspect'], verbs: [] });
        return { text, model: request.model, attempts: 1, contexts: [], timings: { totalMs: 1, attempts: [] } } satisfies AIAnswer;
      },
    },
    createRetriever: () => ({ retrieve: async () => [chunk('q#1#000')] }),
    reranker: noRerank,
    aux: ownAux ? { provider: AIProvider.GEMINI, model: 'aux' } : null,
    registry: null,
    exemplars: null,
    systemPrompt: 'BASE',
    promptLayout: PromptCacheLayout.V2,
  };
  return { service: new EssayService(DEFAULT_ESSAY_SETTINGS, deps), calls, analysisCalls: () => calls.filter((c) => c.request.purpose === EssayCallPurpose.ANALYSIS).length };
}

function write(service: EssayService, sharedAnalysis?: EssayAnalysisSource) {
  return service.write({
    provider: AIProvider.GEMINI, model: 'main', label: 't', content: { textContent: QUESTION, imageBuffers: [] },
    options: { trigger: EssayTrigger.COMMAND, strict: false },
    ...(sharedAnalysis ? { sharedAnalysis } : {}),
  });
}

describe('router aux schema: optional essay block', () => {
  it('parseAuxRouteReply keeps an essay object and ignores a non-object one', () => {
    expect(parseAuxRouteReply(GOOD_REPLY, [])?.essay).toEqual(ESSAY_BLOCK);
    expect(parseAuxRouteReply('{"intent":"qa","confidence":1,"refs":[],"essay":["x"]}', [])?.essay).toBeUndefined();
    expect(parseAuxRouteReply('{"intent":"qa","confidence":1,"refs":[]}', [])).not.toHaveProperty('essay');
  });

  it('only an essay session asks for the block and raises the output cap; the normal session is unchanged', async () => {
    const aux = auxModel(GOOD_REPLY);
    const router = new IntentRouter(aux, { timeoutMs: 1500 });
    await router.session({ slash: true, imageCount: 0, designCount: 0 })!.ask({ question: 'q', registry: [], recentTurns: [], timeoutMs: 1500 });
    await router.essaySession({ imageCount: 0, designCount: 0 }, 6000)!.essayAnalysis('q');
    expect(aux.calls[0].system).not.toContain('"essay"');
    expect(aux.calls[0].maxOutputTokens).toBe(ROUTER_AUX_MAX_OUTPUT_TOKENS);
    expect(aux.calls[1].system).toContain(ROUTER_ESSAY_INSTRUCTIONS);
    expect(aux.calls[1].maxOutputTokens).toBe(ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS);
    expect(aux.calls[1].timeoutMs).toBe(6000);
  });

  it('resolver + essay analysis on one session = ONE call (the resolver request is the one sent)', async () => {
    const aux = auxModel(GOOD_REPLY);
    const session = new IntentRouter(aux, { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!;
    const refs = await session.resolve({ question: 'q', registry: [{ alias: 'A1', kind: 'c4_spec', label: 'x' }] as never, recentTurns: ['user: hi'], timeoutMs: 1000 });
    const essay = await session.essayAnalysis('q');
    expect(aux.calls).toHaveLength(1);
    expect(aux.calls[0].text).toContain('A1');
    // The essay budget wins over the resolver's shorter request timeout.
    expect(aux.calls[0].timeoutMs).toBe(6000);
    expect(refs).toMatchObject({ confidence: 0.9 });
    expect(essay).toEqual({ failed: false, block: ESSAY_BLOCK });
  });

  it('a failed call is flagged; an unparseable answer is not (block null)', async () => {
    const failing = new IntentRouter(auxModel(async () => { throw new Error('boom'); }), { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!;
    expect(await failing.essayAnalysis('q')).toEqual({ failed: true, block: null });
    const garbage = new IntentRouter(auxModel('sorry, no json'), { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!;
    expect(await garbage.essayAnalysis('q')).toEqual({ failed: false, block: null });
  });

  it('the essay block instructions come from the prompt registry when given', async () => {
    const aux = auxModel(GOOD_REPLY);
    const router = new IntentRouter(aux, { timeoutMs: 1500, skills: (id) => (id === ROUTER_ESSAY_SKILL_ID ? 'ESSAY BLOCK v2' : null) });
    await router.essaySession({ imageCount: 0, designCount: 0 }, 6000)!.essayAnalysis('q');
    expect(aux.calls[0].system).toContain('ESSAY BLOCK v2');
  });

  it('prompts/skills/routing/essay-analysis.md is an exact copy of the TS fallback', () => {
    const registry = createPromptRegistry(path.resolve(process.cwd(), 'prompts'));
    expect(registry.skill(ROUTER_ESSAY_SKILL_ID)?.body.trim()).toBe(ROUTER_ESSAY_INSTRUCTIONS.trim());
  });
});

describe('parseAnalysisObject (essay block)', () => {
  it('validates like the JSON reply parser', () => {
    const parsed = parseAnalysisObject(ESSAY_BLOCK, QUESTION)!;
    expect(parsed).toMatchObject({ subject: 'Kiểm thử phần mềm', aspects: ESSAY_BLOCK.aspects, verbs: [EssayVerb.EXPLAIN, EssayVerb.COMPARE], points: 2, fromModel: true });
    expect(parseAnalysisObject({ aspects: [] }, QUESTION)).toBeNull();
    expect(parseAnalysisObject(null, QUESTION)).toBeNull();
    expect(parseAnalysisObject('text', QUESTION)).toBeNull();
  });
});

describe('EssayService with the shared router analysis', () => {
  it('uses the block: no own analysis call; llmCalls counts the shared call', async () => {
    const { service, calls, analysisCalls } = essayService();
    const aux = auxModel(GOOD_REPLY);
    const session = new IntentRouter(aux, { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!;
    const answer = await write(service, session);
    expect(aux.calls).toHaveLength(1);
    expect(analysisCalls()).toBe(0);
    expect(calls).toHaveLength(1);
    expect(answer.essay.aspects).toEqual(ESSAY_BLOCK.aspects);
    expect(answer.essay.subject).toBe('Kiểm thử phần mềm');
    expect(answer.timings?.llmCalls).toBe(2);
    expect(answer.timings!.llmCalls!).toBeLessThanOrEqual(LLM_CALL_BUDGET);
  });

  it('a bad essay block → heuristic, still no second aux call', async () => {
    const { service, analysisCalls } = essayService();
    const aux = auxModel('{"intent":"qa","confidence":0.9,"refs":[],"essay":{"aspects":"not a list"}}');
    const answer = await write(service, new IntentRouter(aux, { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!);
    expect(aux.calls).toHaveLength(1);
    expect(analysisCalls()).toBe(0);
    expect(answer.essay.aspects).toHaveLength(3);
    expect(answer.timings?.llmCalls).toBe(2);
  });

  it('the shared call failed → own analysis call (fallback), then writing', async () => {
    const { service, analysisCalls } = essayService();
    const aux = auxModel(async () => { throw new Error('timeout'); });
    const answer = await write(service, new IntentRouter(aux, { timeoutMs: 1500 }).essaySession({ imageCount: 0, designCount: 0 }, 6000)!);
    expect(analysisCalls()).toBe(1);
    expect(answer.essay.aspects).toEqual(['own aspect']);
    expect(answer.timings?.llmCalls).toBe(3);
  });

  it('the shared call failed and no own aux → heuristic', async () => {
    const { service, calls } = essayService(false);
    const answer = await write(service, { essayAnalysis: async () => ({ failed: true, block: null }) });
    expect(calls).toHaveLength(1);
    expect(answer.essay.aspects).toHaveLength(3);
  });

  it('no shared analysis (router disabled) → the old own analysis call', async () => {
    const { service, analysisCalls } = essayService();
    await write(service);
    expect(analysisCalls()).toBe(1);
  });
});

describe('ChatService: an essay request costs exactly one aux call before writing', () => {
  function chat(callResolver: boolean) {
    const aux = auxModel(GOOD_REPLY);
    const router = new IntentRouter(aux, { timeoutMs: 1500 });
    const essay = essayService();
    const turns: ChatTurns = {
      begin: async (input) => {
        // An ambiguous question: the turn's artifact resolver asks the aux model (step ③).
        if (callResolver) await input.auxResolver?.resolve({ question: input.question, registry: [], recentTurns: [], timeoutMs: 1000 });
        return {
          conversationId: 'conv',
          content: { textContent: input.question, imageBuffers: [] },
          finish: async () => ({ conversationId: 'conv', messageId: 'm', persisted: true }),
        };
      },
    };
    const answers: Answerer = { answer: async (request) => ({ text: 'normal', model: request.model, attempts: 1, contexts: [] }) };
    const service = new ChatService(answers, new ModelCatalog(buildTestAiConfig()), {
      enabled: true, agentEnabled: false, isProviderConfigured: () => true, turns, essay: essay.service,
      essayAux: ({ imageCount }) => router.essaySession({ imageCount, designCount: 0 }, 6000),
    });
    return { service, aux, essay };
  }

  it.each([[true, 'resolver asks first'], [false, 'essay asks (resolver not needed)']])('%s — %s', async (callResolver) => {
    const { service, aux, essay } = chat(callResolver);
    const answer = await service.ask(toChatQuestion({ provider: 'gemini', question: `/essay ${QUESTION}` }));
    expect(aux.calls).toHaveLength(1);
    expect(essay.analysisCalls()).toBe(0);
    expect(answer.essay?.aspects).toEqual(ESSAY_BLOCK.aspects);
  });

  it('a normal question gets no essay session', async () => {
    const { service, aux } = chat(false);
    await service.ask(toChatQuestion({ provider: 'gemini', question: 'QNX là gì?' }));
    expect(aux.calls).toHaveLength(0);
  });
});
