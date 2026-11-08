import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, UnsupportedModelError, type PerProvider } from '../../../../../src/modules/ai';
import { C4SketchService } from '../../../../../src/modules/c4';
import type { C4EventSink, C4ModelCall, C4Session, C4SketchRequest, C4SketchSettings } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { IntentSource, RequestIntent } from '../../../../../src/modules/routing';
import { InMemoryC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { C4Level, C4WorkflowStep, emptyBrief, type DiagramRender } from '../../../../../src/modules/c4/domain';
import { NotFoundError, ServiceDisabledError } from '../../../../../src/shared/errors';
import { buildTestAiConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON, containerSpec, fixedContainerSpec, REQUIREMENTS } from '../../../../support/c4Fixture';

const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-test', gemini: 'gemini-test', grok: 'grok-test', openai: 'openai-test' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const CHUNK = { chunkId: 'k1', text: 'Always draw an API gateway', source: 'rules/c4.md', heading: 'Rules', parentHeading: '', tokenCount: 5 };
const PNG = Buffer.from('png');

const SETTINGS: C4SketchSettings = { enabled: true, deadlineMs: 60_000, criticCutoffMs: 40_000, callTimeoutMs: 30_000, maxElements: 12 };

/** A brief the gap analysis is happy with (no questions). */
const CONFIDENT_BRIEF = JSON.stringify({ brief: {
  systemName: { value: 'Cinema', confidence: 0.95 }, systemBoundary: { value: 'Booking website + API', confidence: 0.9 },
  actors: { value: ['Customer'], confidence: 0.9 }, externalSystems: { value: ['VNPay'], confidence: 0.9 },
  functionalReqs: ['Book tickets', 'Pay via VNPay'], techConstraints: { value: [], confidence: 0.8 },
  levels: { value: ['context', 'container'], confidence: 0.9 },
}, typed: {} });

/** Steps of the recorded calls (label `c4-<start>-<n>-<step>`). */
function steps(calls: C4ModelCall[]): string[] {
  return calls.map((c) => c.label.split('-').slice(3).join('-'));
}

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
        const step = call.label.split('-').slice(3).join('-');
        const text = answer(call, step) ?? (step === 'extract' ? CONFIDENT_BRIEF : undefined);
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

const REQUEST: C4SketchRequest = { provider: AIProvider.GEMINI, description: 'Cinema booking with VNPay', levels: [], fast: false, stream: false, images: [] };

describe('C4SketchService', () => {
  it('runs architect → repair → critic: 3 model calls for 2 levels, knowledge in the system prompt', async () => {
    const model = scriptedModel((_call, step) => ({
      architect: architect(true),
      repair: JSON.stringify({ diagrams: { Container: fixedContainerSpec() } }),
      critic: '{"levels":{"context":{"verdict":"ok"},"container":{"verdict":"ok"}}}',
    })[step]);
    const result = await service(model).sketch(REQUEST);

    expect(steps(model.calls)).toEqual(['extract', 'architect', 'repair', 'critic']);
    expect(model.calls[1].systemPrompt).toContain('Always draw an API gateway');
    expect(model.calls[1].systemPrompt).not.toContain('CITATION RULES');
    expect(model.calls[3].images).toHaveLength(2);
    expect(result.intent).toMatchObject({ intent: 'c4_generate', source: 'rule' });
    expect(result.criticNotes).toEqual(['context: critic không thấy vấn đề', 'container: critic không thấy vấn đề']);
    expect(result).toMatchObject({ model: 'gemini-test', systemName: 'Cinema', knowledgeSources: ['rules/c4.md'], deadlineHit: false });
    expect(result.requirements.map((r) => r.id)).toEqual(['R1', 'R2', 'R3']);
    const [context, container] = result.levels;
    expect(context).toMatchObject({ level: C4Level.CONTEXT, notes: ['critic: không thấy vấn đề'], missing: [] });
    expect(container.puml).toContain('Rel_R(api, pay, "Charges", "HTTPS")');
    expect(container).toMatchObject({ missing: [], notes: ['đã tự sửa', 'critic: không thấy vấn đề'], error: undefined });
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
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'draft-container', 'repair']);
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
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'repair']);
    expect(result.levels.every((l) => l.png)).toBe(true); // best effort: the unrepaired images are still returned
  });

  it('retries an answer that is not JSON once', async () => {
    let architectCalls = 0;
    const model = scriptedModel((_call, step) => {
      if (step.startsWith('architect')) return ++architectCalls === 1 ? 'sorry, here is prose' : architect(false);
      return undefined;
    });
    const result = await service(model).sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true });
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'architect-retry']);
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


  it('streams intent and brief before drawing', async () => {
    const events: string[] = [];
    const sink: C4EventSink = {
      progress: () => undefined,
      analysis: () => events.push('analysis'),
      level: (result) => events.push(`level:${result.level}`),
      intent: (d) => events.push(`intent:${d.intent}`),
      brief: (b) => events.push(`brief:${b.systemName.value}`),
    };
    const model = scriptedModel((_call, step) => (step === 'architect' ? architect(false) : undefined));
    await service(model).sketch({ ...REQUEST, levels: [C4Level.CONTEXT], fast: true }, sink);
    expect(events.slice(0, 3)).toEqual(['intent:c4_generate', 'brief:Cinema', 'analysis']);
  });

  it('gives the problem images to extract, architect, drafter and repair', async () => {
    const page1 = { data: Buffer.from('p1'), mimeType: 'image/png' };
    const page2 = { data: Buffer.from('p2'), mimeType: 'image/png' };
    const model = scriptedModel((_call, step) => {
      if (step === 'architect') return architect(false);
      if (step === 'draft-container') return JSON.stringify(fixedContainerSpec());
      if (step === 'repair') return JSON.stringify({ diagrams: {} });
      return undefined;
    });
    await service(model, { failFirstWith: 'C4_Context' }).sketch({ ...REQUEST, description: '', images: [page1, page2], fast: true });
    const byStep = new Map(model.calls.map((c) => [c.label.split('-').slice(3).join('-'), c.images.length]));
    expect(byStep.get('extract')).toBe(2);
    expect(byStep.get('architect')).toBe(2);
    expect(byStep.get('draft-container')).toBe(2);
    expect(byStep.get('repair')).toBe(2);
  });
});

const VAGUE_BRIEF = JSON.stringify({ brief: {
  systemName: { value: 'Cinema', confidence: 0.9 }, systemBoundary: { value: '', confidence: 0 },
  actors: { value: ['Customer'], confidence: 0.9 }, externalSystems: { value: [], confidence: 0.3 },
  techConstraints: { value: [], confidence: 0.2 }, levels: { value: [], confidence: 0 },
}, typed: {} });

describe('C4SketchService: HITL clarify (note 05 §5)', () => {
  function pausing(onArchitect?: (call: C4ModelCall) => void) {
    return scriptedModel((call, step) => {
      if (step === 'extract') return VAGUE_BRIEF;
      if (step === 'architect') { onArchitect?.(call); return architect(true); }
      if (step === 'repair') return JSON.stringify({ diagrams: { container: fixedContainerSpec() } });
      if (step === 'critic') return '{"levels":{}}';
      return undefined;
    });
  }

  it('pauses with the brief summary and at most 3 questions with defaults (clock stopped), "ok" draws the defaults', async () => {
    let clock = 1_000_000;
    const now = () => clock;
    const sessions = new InMemoryC4SessionRepository(now);
    const events: string[] = [];
    const model = pausing();
    const svc = new C4SketchService(SETTINGS, {
      catalog: CATALOG, sessions, model: model.gateway, knowledge: { search: async () => [] }, renderer: renderer(), puml: {}, now,
    });

    const sink: C4EventSink = { progress: () => undefined, analysis: () => undefined, level: () => undefined, clarify: (c) => events.push(`clarify:${c.questions.length}`) };
    const paused = await svc.sketch({ ...REQUEST, levels: [] }, sink);
    expect(paused.levels).toEqual([]);
    expect(events).toEqual(['clarify:3']);
    expect(paused.clarify?.questions.map((q) => q.slot)).toEqual(['systemBoundary', 'levels', 'externalSystems']);
    expect(paused.clarify?.questions.every((q) => q.default.length > 0)).toBe(true);
    expect(paused.clarify?.summary.length).toBeGreaterThanOrEqual(3);
    expect(paused.clarify?.summary.length).toBeLessThanOrEqual(5);
    expect(paused.confirmation?.clarifications[1]).toEqual({ question: 'Cần vẽ đến level nào?', assumption: 'Context + Container' });
    expect(steps(model.calls)).toEqual(['extract']);

    clock += 10 * 60_000; // the user reads for 10 minutes: not counted
    const done = await svc.resume({ sessionId: paused.confirmation!.sessionId, answers: 'ok', stream: false });
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'repair', 'critic']);
    expect(done.levels.map((l) => l.level)).toEqual([C4Level.CONTEXT, C4Level.CONTAINER]);
    expect(done.elapsedMs).toBeLessThan(60_000);
    await expect(svc.resume({ sessionId: paused.confirmation!.sessionId, stream: false })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a partial numbered reply updates that slot; the others keep their defaults', async () => {
    let architectText = '';
    const model = pausing((call) => { architectText = call.text; });
    const svc = service(model);
    const paused = await svc.sketch({ ...REQUEST });
    const done = await svc.resume({ sessionId: paused.clarify!.sessionId, answers: '2. chỉ context', stream: false });
    expect(done.brief?.levels.value).toEqual([C4Level.CONTEXT]);
    expect(done.levels.map((l) => l.level)).toEqual([C4Level.CONTEXT]);
    expect(done.brief?.systemBoundary.value).toBe('Suy ra từ tên đề: Cinema');
    expect(architectText).toContain('2. chỉ context');
  });

  it('parses a free-text reply with the aux model', async () => {
    const auxCalls: string[] = [];
    const model = pausing();
    const svc = new C4SketchService(SETTINGS, {
      catalog: CATALOG, sessions: new InMemoryC4SessionRepository(), model: model.gateway, knowledge: { search: async () => [] }, renderer: renderer(), puml: {},
      aux: { complete: async (call) => { auxCalls.push(call.text); return '{"answers": {"externalSystems": "Không", "unknownSlot": "x"}}'; } },
    });
    const paused = await svc.sketch({ ...REQUEST });
    const done = await svc.resume({ sessionId: paused.clarify!.sessionId, answers: 'không tích hợp gì cả, còn lại tuỳ bạn', stream: false });
    expect(auxCalls).toHaveLength(1);
    expect(done.brief?.externalSystems).toMatchObject({ value: [], confidence: 1 });
    expect(done.brief?.levels.value).toEqual([C4Level.CONTEXT, C4Level.CONTAINER]);
  });

  it('skips the questions with --fast', async () => {
    const model = pausing();
    const result = await service(model).sketch({ ...REQUEST, fast: true });
    expect(result.clarify).toBeUndefined();
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'repair']);
  });

  it('drops expired sessions', async () => {
    let clock = 0;
    const sessions = new InMemoryC4SessionRepository(() => clock);
    await sessions.save(sessionFixture('s1', 100));
    clock = 100;
    expect(await sessions.take('s1')).toBeUndefined();
  });
});

describe('C4SketchService: review mode (note 05 §6)', () => {
  const problem = { data: Buffer.from('problem'), mimeType: 'image/png' };
  const design = { data: Buffer.from('design'), mimeType: 'image/png' };
  const REVIEW_MD = 'Thiết kế khá tốt.\n## Bảng điểm\n| Coverage | 7/10 | thiếu VNPay |\n## Đề xuất sửa lỗi\n1. Thêm VNPay';

  it('reviews the user design image without drawing: design-read, then the review streamed in the fixed frame', async () => {
    const deltas: string[] = [];
    const model = scriptedModel((_call, step) => {
      if (step === 'extract') return JSON.stringify({ brief: { ...JSON.parse(CONFIDENT_BRIEF).brief, userDesign: { present: true, imageIndexes: [1] } } });
      if (step === 'design-read') return JSON.stringify({ systemName: 'Cinema', diagrams: { context: CONTEXT_SPEC_JSON } });
      if (step === 'review') return REVIEW_MD;
      return undefined;
    });
    const sink: C4EventSink = { progress: () => undefined, analysis: () => undefined, level: () => undefined, reviewDelta: (t) => deltas.push(t) };
    const result = await service(model).sketch({ ...REQUEST, description: 'nhận xét thiết kế này giúp mình', images: [problem, design] }, sink);
    expect(result.intent?.intent).toBe('c4_review');
    expect(steps(model.calls)).toEqual(['extract', 'design-read', 'review']);
    expect(model.calls[1].images.map((i) => i.data.toString())).toEqual(['design']);
    expect(result.levels).toEqual([]);
    expect(deltas.join('')).toBe(REVIEW_MD);
    const md = result.review!.markdown;
    const headings = md.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['## Tóm tắt nhận xét', '## Đánh giá theo tiêu chí', '## Yêu cầu chưa đáp ứng', '## Lỗi ký hiệu C4', '## Đề xuất sửa (ưu tiên)']);
    expect(md).toContain('| Tiêu chí | Điểm | Nhận xét |');
    expect(md).toContain('Thiết kế khá tốt.');
    expect(md).toContain('1. Thêm VNPay');
  });

  it('"vẽ rồi đánh giá" draws, then reviews the fresh spec', async () => {
    const model = scriptedModel((_call, step) => ({ architect: architect(false), review: REVIEW_MD } as Record<string, string>)[step]);
    const result = await service(model).sketch({ ...REQUEST, description: 'Vẽ C4 cho đề này rồi đánh giá', levels: [C4Level.CONTEXT], fast: true });
    expect(result.intent?.intent).toBe('c4_generate_and_review');
    expect(steps(model.calls)).toEqual(['extract', 'architect', 'review']);
    expect(model.calls[2].images).toHaveLength(1);
    expect(model.calls[2].text).toContain('thiết kế vừa vẽ');
    expect(result.levels[0].png).toEqual(PNG);
    expect(result.review?.designSource).toBe('generated');
  });
});

function sessionFixture(id: string, expiresAt: number): C4Session {
  return {
    id, step: C4WorkflowStep.CLARIFY, request: REQUEST, model: 'm', knowledge: [], remainingMs: 1, activeMs: 1, expiresAt, label: 'l',
    intent: { intent: RequestIntent.C4_GENERATE, confidence: 0.9, source: IntentSource.RULE }, intentConfidence: 0.9,
    brief: emptyBrief(), systemName: '', summary: [], questions: [],
  };
}
