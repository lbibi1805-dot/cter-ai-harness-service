import { describe, expect, it } from 'vitest';
import { AIProvider, ModelCatalog, type PerProvider } from '../../../../../src/modules/ai';
import { C4SketchService } from '../../../../../src/modules/c4';
import type { C4DiscussionResult, C4EventSink, C4ModelCall, C4SketchRequest, C4SketchSettings } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import { InMemoryC4SessionRepository } from '../../../../../src/modules/c4/infrastructure/inMemoryC4Session.repository';
import { C4Level, ConnectivityCode, DISCUSSION_PLACEHOLDER, DISCUSSION_SECTIONS } from '../../../../../src/modules/c4/domain';
import { toC4LevelDto, toC4SketchDto, toC4SketchRequest } from '../../../../../src/modules/c4/presentation/mappers/c4.mapper';
import { buildTestAiConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON, fixedContainerSpec, REQUIREMENTS } from '../../../../support/c4Fixture';

const DEFAULT_MODELS: PerProvider<string> = { claude: 'claude-test', gemini: 'gemini-test', grok: 'grok-test', openai: 'openai-test' };
const CATALOG = new ModelCatalog(buildTestAiConfig({ defaultModels: DEFAULT_MODELS }));
const SETTINGS: C4SketchSettings = { enabled: true, deadlineMs: 60_000, criticCutoffMs: 40_000, callTimeoutMs: 30_000, maxElements: 12 };
const CONFIDENT_BRIEF = JSON.stringify({ brief: {
  systemName: { value: 'Cinema', confidence: 0.95 }, systemBoundary: { value: 'Booking website + API', confidence: 0.9 },
  actors: { value: ['Customer'], confidence: 0.9 }, externalSystems: { value: ['VNPay'], confidence: 0.9 },
  functionalReqs: ['Book tickets'], techConstraints: { value: [], confidence: 0.8 }, levels: { value: ['context', 'container'], confidence: 0.9 },
}, typed: {} });
const DISCUSSION = '## 1. Cloud\nAWS.\n## 2. Triển khai\nRolling.\n## 3. Kafka\nKhông cần.\n## 5. Multi-tenancy\nNot needed.\n## 6. Bảo mật\nOAuth2.\n## 7. Instances\nAPI x 2.';
const REQUEST: C4SketchRequest = { provider: AIProvider.GEMINI, description: 'Cinema booking with VNPay', levels: [], fast: true, stream: true, images: [] };

const step = (call: C4ModelCall) => call.label.split('-').slice(3).join('-');

function model(container: unknown, extra: Record<string, string> = {}) {
  const calls: C4ModelCall[] = [];
  const answers: Record<string, string> = {
    extract: CONFIDENT_BRIEF,
    architect: JSON.stringify({ systemName: 'Cinema', requirements: REQUIREMENTS, diagrams: { context: CONTEXT_SPEC_JSON, container } }),
    discussion: DISCUSSION,
    ...extra,
  };
  const answer = (call: C4ModelCall) => {
    calls.push(call);
    return answers[step(call)] ?? new Promise<string>(() => undefined);
  };
  return {
    calls,
    gateway: {
      ask: async (call: C4ModelCall) => answer(call),
      stream: async (call: C4ModelCall, onDelta: (text: string) => void) => {
        const text = await answer(call);
        onDelta(text.slice(0, 10));
        onDelta(text.slice(10));
        return text;
      },
    },
  };
}

function service(m: ReturnType<typeof model>, settings: Partial<C4SketchSettings> = {}) {
  return new C4SketchService({ ...SETTINGS, ...settings }, {
    catalog: CATALOG, sessions: new InMemoryC4SessionRepository(), model: m.gateway,
    knowledge: { search: async () => [] }, renderer: { render: async () => ({ png: Buffer.from('png') }) }, puml: { includeBase: 'stdlib' },
  });
}

function sink() {
  const events: Array<[string, unknown]> = [];
  const s: C4EventSink = {
    progress: () => undefined, analysis: () => undefined,
    level: (r) => events.push(['level', r.connectivity]),
    discussionDelta: (text) => events.push(['delta', text]),
    discussionDone: (d: C4DiscussionResult) => events.push(['done', d.markdown]),
  };
  return { events, s };
}

describe('C4 design discussion step (12/11 plan 04 §5.3)', () => {
  it('runs after the critic even with fast, streams deltas, and returns the seven-topic frame', async () => {
    const m = model(fixedContainerSpec());
    const { events, s } = sink();
    const result = await service(m).sketch(REQUEST, s);

    expect(m.calls.map(step)).toEqual(['extract', 'architect', 'discussion']);
    const discussionCall = m.calls[2];
    expect(discussionCall.systemPrompt).toContain('markdown only');
    expect(discussionCall.text).toContain('## 7. Số instance và auto-scaling');
    expect(discussionCall.text).toContain('"level":"container"');
    // The container spec has no instances: the writer is told so.
    expect(discussionCall.text).toContain(ConnectivityCode.MISSING_INSTANCES);
    expect(events.filter(([type]) => type === 'delta').map(([, text]) => text).join('')).toBe(DISCUSSION);
    const headings = result.discussion!.markdown.split('\n').filter((line) => line.startsWith('## '));
    expect(headings).toEqual(DISCUSSION_SECTIONS.map((section) => section.heading));
    expect(result.discussion!.markdown).toContain(`${DISCUSSION_SECTIONS[3].heading}\n\n${DISCUSSION_PLACEHOLDER}`);
    expect(events.at(-1)).toEqual(['done', result.discussion!.markdown]);
    expect(toC4SketchDto(result).discussion).toEqual({ markdown: result.discussion!.markdown });
  });

  it('noDiscussion: true skips it; C4_DESIGN_DISCUSSION_ENABLED=false skips it', async () => {
    const skipped = model(fixedContainerSpec());
    const result = await service(skipped).sketch({ ...REQUEST, noDiscussion: true });
    expect(skipped.calls.map(step)).toEqual(['extract', 'architect']);
    expect(result.discussion).toBeUndefined();
    expect(toC4SketchDto(result)).not.toHaveProperty('discussion');

    const off = model(fixedContainerSpec());
    await service(off, { designDiscussionEnabled: false }).sketch(REQUEST);
    expect(off.calls.map(step)).toEqual(['extract', 'architect']);
  });

  it('a failed writer gives discussion null without failing the run', async () => {
    const m = model(fixedContainerSpec(), { discussion: '   ' });
    const result = await service(m).sketch(REQUEST);
    expect(result.discussion).toBeNull();
    expect(result.levels.every((l) => l.png)).toBe(true);
  });
});

describe('C4 connectivity in the run (plan 04 §4)', () => {
  it('an orphan container goes to repair; the level event carries connectivity; counters count found and repaired', async () => {
    const broken = fixedContainerSpec();
    broken.elements.push({ id: 'report', kind: 'container' as never, variant: 'standard' as never, external: false, name: 'Report', desc: 'Reports', tech: 'Node', parent: 'cinema', covers: ['R2'] });
    const m = model(broken, { repair: JSON.stringify({ diagrams: { container: fixedContainerSpec() } }) });
    const { events, s } = sink();
    const svc = service(m);
    const result = await svc.sketch({ ...REQUEST, noDiscussion: true }, s);

    expect(m.calls.map(step)).toEqual(['extract', 'architect', 'repair']);
    expect(m.calls[2].text).toContain("ORPHAN_ELEMENT: 'report' has no relationship");
    const container = result.levels.find((l) => l.level === C4Level.CONTAINER)!;
    expect(container.connectivity!.errors).toEqual([]);
    expect(container.connectivity!.warnings.map((w) => w.code)).toContain(ConnectivityCode.MISSING_INSTANCES);
    expect(events.filter(([type]) => type === 'level').length).toBeGreaterThan(0);
    expect(toC4LevelDto(container).connectivity.warnings.length).toBeGreaterThan(0);
    expect(svc.connectivityStats()).toEqual({ orphanFound: 1, orphanRepaired: 1, connectivityErrors: 1 });
  });

  it('errors left after repair keep the diagram and add a critic note', async () => {
    const broken = fixedContainerSpec();
    broken.elements.push({ id: 'report', kind: 'container' as never, variant: 'standard' as never, external: false, name: 'Report', desc: 'Reports', tech: 'Node', parent: 'cinema', covers: ['R2'] });
    const m = model(broken, { repair: JSON.stringify({ diagrams: { container: broken } }) });
    const svc = service(m);
    const result = await svc.sketch({ ...REQUEST, noDiscussion: true });
    const container = result.levels.find((l) => l.level === C4Level.CONTAINER)!;
    expect(container.png).toBeDefined();
    expect(container.connectivity!.errors.map((e) => e.code)).toEqual([ConnectivityCode.ORPHAN_ELEMENT]);
    expect(result.criticNotes?.some((n) => n.startsWith('container: còn lỗi kết nối'))).toBe(true);
    expect(svc.connectivityStats()).toMatchObject({ orphanFound: 1, orphanRepaired: 0 });
  });
});

describe('POST /api/c4 body: noDiscussion', () => {
  it('parses noDiscussion only when true', () => {
    const base = { provider: 'gemini', description: 'x' };
    expect(toC4SketchRequest({ ...base, noDiscussion: true }).noDiscussion).toBe(true);
    expect(toC4SketchRequest({ ...base, fast: true })).not.toHaveProperty('noDiscussion');
  });
});
