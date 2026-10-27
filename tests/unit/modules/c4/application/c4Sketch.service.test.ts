import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, UnsupportedModelError, type PerProvider } from '../../../../../src/modules/ai';
import { C4SketchService } from '../../../../../src/modules/c4';
import type { C4EventSink, C4ModelCall, C4SketchRequest, C4SketchSettings } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { InMemoryC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { C4Level, type DiagramRender } from '../../../../../src/modules/c4/domain';
import { NotFoundError, ServiceDisabledError } from '../../../../../src/shared/errors';
import { buildTestAiConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON, containerSpec, fixedContainerSpec, REQUIREMENTS } from '../../../../support/c4Fixture';

const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-test', gemini: 'gemini-test', grok: 'grok-test', openai: 'openai-test' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const CHUNK = { chunkId: 'k1', text: 'Always draw an API gateway', source: 'rules/c4.md', heading: 'Rules', parentHeading: '', tokenCount: 5 };
const PNG = Buffer.from('png');

const SETTINGS: C4SketchSettings = { enabled: true, deadlineMs: 60_000, criticCutoffMs: 40_000, callTimeoutMs: 30_000, maxElements: 12 };

function architect(withContainer: boolean, model?: unknown, clarifications?: unknown): string {
  const diagrams = { context: CONTEXT_SPEC_JSON, ...(withContainer ? { container: containerSpec() } : {}) };
  return `Here you go:\n\`\`\`json\n${JSON.stringify({ systemName: 'Cinema', requirements: REQUIREMENTS, model, clarifications, diagrams })}\n\`\`\``;
}

/** Answers by step (from the call label); `undefined` hangs until the per-call timeout. */
function scriptedModel(answer: (call: C4ModelCall, step: string) => string | undefined) {
  const calls: C4ModelCall[] = [];
  return {
    calls,
    gateway: {
      ask: async (call: C4ModelCall) => {
        calls.push(call);
        const text = answer(call, call.label.split('-').slice(3).join('-'));
        return text ?? new Promise<string>(() => undefined);
      },
    },
  };
}

function renderer(failFirstWith?: string) {
  let fail = failFirstWith;
  return {
    render: async (puml: string): Promise<DiagramRender> => {
      if (fail && puml.includes(fail)) {
        fail = undefined;
        return { syntaxError: 'Syntax Error?', errorLine: 7 };
      }
      return { png: PNG };
    },
  };
}

interface ServiceOptions {
  failFirstWith?: string;
  settings?: Partial<C4SketchSettings>;
  knowledge?: () => Promise<typeof CHUNK[]>;
  sessions?: InMemoryC4SessionRepository;
}

function service(model: ReturnType<typeof scriptedModel>, opts: ServiceOptions = {}) {
  return new C4SketchService({ ...SETTINGS, ...opts.settings }, {
    catalog: CATALOG,
    sessions: opts.sessions ?? new InMemoryC4SessionRepository(),
    model: model.gateway,
    knowledge: { search: opts.knowledge ?? (async () => [CHUNK]) },
    renderer: renderer(opts.failFirstWith),
    puml: { includeBase: 'stdlib' },
  });
}

const REQUEST: C4SketchRequest = { provider: AIProvider.GEMINI, description: 'Cinema booking with VNPay', levels: [], fast: false, stream: false };

describe('C4SketchService', () => {
  it('runs architect → repair → critic: 3 model calls for 2 levels, knowledge in the system prompt', async () => {
    const model = scriptedModel((_call, step) => ({
      architect: architect(true),
      repair: JSON.stringify({ diagrams: { Container: fixedContainerSpec() } }),
      critic: '{"levels":{"context":{"verdict":"ok"},"container":{"verdict":"ok"}}}',
    })[step]);
    const result = await service(model).sketch(REQUEST);

    expect(model.calls.map((c) => c.label.split('-').slice(3).join('-'))).toEqual(['architect', 'repair', 'critic']);
    expect(model.calls[0].systemPrompt).toContain('Always draw an API gateway');
    expect(model.calls[0].systemPrompt).not.toContain('CITATION RULES');
    expect(model.calls[2].images).toHaveLength(2);
    expect(result).toMatchObject({ model: 'gemini-test', systemName: 'Cinema', knowledgeSources: ['rules/c4.md'], deadlineHit: false });
    expect(result.requirements.map((r) => r.id)).toEqual(['R1', 'R2', 'R3']);
    const [context, container] = result.levels;
    expect(context).toMatchObject({ level: C4Level.CONTEXT, notes: ['review: ok'], missing: [] });
    expect(container.puml).toContain('Rel_R(api, pay, "Charges", "HTTPS")');
    expect(container).toMatchObject({ missing: [], notes: ['đã tự sửa', 'review: ok'], error: undefined });
    expect(container.png).toEqual(PNG);
  });

  it('drafts a level the architect skipped, repairs a PlantUML syntax error, skips the critic with fast', async () => {
    const model = scriptedModel((call, step) => {
      if (step === 'architect') return architect(false);
      if (step === 'draft-container') return JSON.stringify(fixedContainerSpec());
      if (step === 'repair' && call.text.includes('PlantUML rejected')) return JSON.stringify({ diagrams: { ctx: CONTEXT_SPEC_JSON } });
      return undefined;
    });
    const result = await service(model, { failFirstWith: 'C4_Context' }).sketch({ ...REQUEST, levels: [C4Level.CONTAINER, C4Level.CONTEXT], fast: true });
    expect(result.levels.map((l) => l.level)).toEqual([C4Level.CONTEXT, C4Level.CONTAINER]);
    expect(result.levels.every((l) => l.png)).toBe(true);
    expect(result.levels[0].notes).toEqual(['đã tự sửa']);
    expect(model.calls).toHaveLength(3);
  });

  it('sends diagrams missing a shared-model actor or external system to repair', async () => {
    const model = scriptedModel((call, step) => {
      if (step === 'architect') {
        return architect(true, { actors: [{ id: 'customer', name: 'Customer' }], externalSystems: [{ id: 'pay', name: 'VNPay' }, { id: 'mailer', name: 'Email' }] });
      }
      if (step === 'repair') {
        expect(call.text).toContain("'Email' (id mailer) from the shared model is missing");
        return JSON.stringify({ diagrams: {} });
      }
      return undefined;
    });
    const result = await service(model).sketch({ ...REQUEST, fast: true });
    expect(model.calls.map((c) => c.label.split('-').slice(3).join('-'))).toEqual(['architect', 'repair']);
    expect(result.levels.every((l) => l.png)).toBe(true); // best effort: the unrepaired images are still returned
  });

  it('retries an answer that is not JSON once', async () => {
    let architectCalls = 0;
    const model = scriptedModel((_call, step) => {
      if (step.startsWith('architect')) return ++architectCalls === 1 ? 'sorry, here is prose' : architect(false);
      return undefined;
    });
    const result = await service(model).sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true });
    expect(model.calls.map((c) => c.label.split('-').slice(3).join('-'))).toEqual(['architect', 'architect-retry']);
    expect(result.levels[0].png).toEqual(PNG);
  });

  it('keeps the rendered image when the critic does not answer before its timeout', async () => {
    const model = scriptedModel((_call, step) => (step === 'architect' ? architect(false) : undefined));
    const result = await service(model, { settings: { callTimeoutMs: 50 } }).sketch({ ...REQUEST, levels: [C4Level.CONTEXT] });
    expect(result.levels[0]).toMatchObject({ error: undefined });
    expect(result.levels[0].png).toEqual(PNG);
  });

  it('reports per-level errors when no model answer is usable, and still works without knowledge', async () => {
    const model = scriptedModel(() => 'no json at all');
    const result = await service(model, { knowledge: async () => { throw new Error('pinecone down'); } })
      .sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true });
    expect(result.requirements).toEqual([]);
    expect(result.knowledgeSources).toEqual([]);
    expect(result.levels[0].png).toBeUndefined();
    expect(result.levels[0].error).toMatch(/not JSON/);
  });

  it('validates the model and fails closed without a token', async () => {
    const model = scriptedModel(() => undefined);
    await expect(service(model).sketch({ ...REQUEST, requestedModel: 'nope' })).rejects.toBeInstanceOf(UnsupportedModelError);
    await expect(service(model, { settings: { enabled: false } }).sketch(REQUEST)).rejects.toBeInstanceOf(ServiceDisabledError);
  });

  it('streams progress, the analysis and each image as it is rendered', async () => {
    const events: string[] = [];
    const sink: C4EventSink = {
      progress: (message) => events.push(`progress:${message}`),
      analysis: (plan, sources) => events.push(`analysis:${plan.requirements.length}:${sources.join(',')}`),
      level: (result) => events.push(`level:${result.level}`),
    };
    const model = scriptedModel((_call, step) => (step === 'architect' ? architect(false) : undefined));
    await service(model).sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true }, sink);
    expect(events[0]).toMatch(/^progress:/);
    expect(events).toContain('analysis:3:rules/c4.md');
    expect(events.indexOf('level:context')).toBeGreaterThan(events.indexOf('analysis:3:rules/c4.md'));
  });

  it('pauses for clarifications (clock stopped), then draws the drafted assumptions on a blank resume', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const sessions = new InMemoryC4SessionRepository(now);
    const questions = [{ question: 'Which payment gateway?', assumption: 'VNPay' }];
    const model = scriptedModel((_call, step) => (step === 'architect' ? architect(false, undefined, questions) : undefined));
    const svc = new C4SketchService(SETTINGS, {
      catalog: CATALOG, sessions, model: model.gateway, knowledge: { search: async () => [] }, renderer: renderer(), puml: {}, now,
    });

    const paused = await svc.sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true });
    expect(paused.levels).toEqual([]);
    expect(paused.confirmation?.clarifications).toEqual(questions);
    expect(model.calls).toHaveLength(1);

    clock += 10 * 60_000; // the user reads for 10 minutes: not counted
    const done = await svc.resume({ sessionId: paused.confirmation!.sessionId, stream: false });
    expect(model.calls).toHaveLength(1); // assumptions kept: no extra call
    expect(done.levels[0].png).toEqual(PNG);
    expect(done.elapsedMs).toBeLessThan(60_000);
    await expect(svc.resume({ sessionId: paused.confirmation!.sessionId, stream: false })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('re-runs the architect with the user answers on resume', async () => {
    const questions = [{ question: 'Who are the users?', assumption: 'Customers only' }];
    const model = scriptedModel((call, step) => {
      if (step === 'architect') return architect(false, undefined, questions);
      if (step === 'architect-answers') {
        expect(call.text).toContain('Admins manage showtimes too');
        expect(call.text).toContain('return "clarifications": []');
        return architect(false);
      }
      return undefined;
    });
    const svc = service(model);
    const paused = await svc.sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true });
    const done = await svc.resume({ sessionId: paused.confirmation!.sessionId, answers: 'Admins manage showtimes too', stream: false });
    expect(model.calls.map((c) => c.label.split('-').slice(3).join('-'))).toEqual(['architect', 'architect-answers']);
    expect(done.confirmation).toBeUndefined();
    expect(done.levels[0].png).toEqual(PNG);
  });

  it('drops expired sessions', () => {
    let clock = 0;
    const sessions = new InMemoryC4SessionRepository(() => clock);
    sessions.save({ id: 's1', request: REQUEST, model: 'm', knowledge: [], architect: {}, remainingMs: 1, activeMs: 1, expiresAt: 100, label: 'l' });
    clock = 100;
    expect(sessions.take('s1')).toBeUndefined();
  });
});
