import { describe, it, expect, vi } from 'vitest';
import { AgentFallbackReason, AgentStopReason, AnswerMode, type Answerer, type AnswerRequest } from '../../../src/modules/agent/domain';
import type { GoldenItem } from '../../rag/domain';
import { AnswerMetric, DriftStatus, type AnswerEvalReport } from '../domain';
import { runAnswerEval } from './answerEvaluation';
import { analyzeDrift } from './driftAnalysis';
import type { AnswerJudge, TextEmbedder } from './ports';

const GOLDEN: GoldenItem[] = [
  { id: 'mutex', question: 'mutex?', expectedSources: ['lab-4/Mutex.md'], keyPoints: ['owner', 'unlock'], answerable: true },
  { id: 'offtopic', question: 'capital of Australia?', expectedSources: [], keyPoints: [], answerable: false },
];

/** Clock that advances by the latency the fake answerer "spends". */
function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

function fakeAnswerer(clock: ReturnType<typeof fakeClock>): Answerer & { requests: AnswerRequest[] } {
  const requests: AnswerRequest[] = [];
  return {
    requests,
    async answer(request) {
      requests.push(request);
      const agent = request.mode === AnswerMode.AGENT;
      clock.advance(agent ? 9_000 : 3_000);
      if (request.label === 'eval:offtopic' && agent) throw new Error('HTTP 500');
      if (request.label === 'eval:offtopic') return { text: 'The provided documents do not contain information about this topic', model: 'm', attempts: 1, mode: AnswerMode.SINGLE_SHOT };
      return agent
        ? { text: 'Owner unlocks.\n## References\n- lab-4/Mutex.md', model: 'm', attempts: 3, mode: AnswerMode.AGENT, agent: { stopReason: AgentStopReason.FINAL_ANSWER, toolCalls: 2, sourcesRead: ['lab-4/Mutex.md'], usage: { inputTokens: 1000, outputTokens: 200 } } }
        : { text: 'Owner only.\n## References\n- other.md', model: 'm', attempts: 1, mode: AnswerMode.SINGLE_SHOT, fallbackReason: undefined };
    },
  };
}

const judge: AnswerJudge = {
  model: 'judge',
  judge: vi.fn(async ({ item, answer }) => {
    if (!item.answerable) return { claims: [], keyPointsCovered: [], relevance: 5, refused: /do not contain/.test(answer), notes: '' };
    const agent = answer.startsWith('Owner unlocks');
    return {
      claims: [{ text: 'owner', supported: true }, { text: 'x', supported: agent }],
      keyPointsCovered: [true, agent],
      relevance: agent ? 5 : 3,
      refused: false,
      notes: '',
    };
  }),
};

const references = { load: vi.fn(async (paths: string[]) => `REF ${paths.join(',')}`) };
const embedder: TextEmbedder = { embed: async (text) => (text.startsWith('Owner unlocks') ? [1, 0] : [0.6, 0.8]) };

async function run(modes = [AnswerMode.SINGLE_SHOT, AnswerMode.AGENT], repeats = 1) {
  const clock = fakeClock();
  const answerer = fakeAnswerer(clock);
  const result = await runAnswerEval(GOLDEN, { answerer, judge, references, embedder, provider: 'openai', answerModel: 'gpt-6-astra', now: clock.now }, { modes, repeats });
  return { result, answerer };
}

describe('runAnswerEval', () => {
  it('asks every question in every mode through the production answer port', async () => {
    const { result, answerer } = await run();
    expect(answerer.requests.map((r) => `${r.label}/${r.mode}`)).toEqual([
      'eval:mutex/single-shot', 'eval:mutex/agent', 'eval:offtopic/single-shot', 'eval:offtopic/agent',
    ]);
    expect(answerer.requests.every((r) => r.provider === 'openai' && r.model === 'gpt-6-astra')).toBe(true);
    expect(result.samples).toHaveLength(4);
    expect(references.load).toHaveBeenCalledWith(['lab-4/Mutex.md']);
  });

  it('aggregates precision, completeness, citations, refusals, errors and latency per mode', async () => {
    const { result } = await run();
    const single = result.summaries.find((s) => s.mode === AnswerMode.SINGLE_SHOT)!;
    const agent = result.summaries.find((s) => s.mode === AnswerMode.AGENT)!;

    expect(single.metrics).toMatchObject({
      [AnswerMetric.ANSWER_PRECISION]: 0.5,
      [AnswerMetric.COMPLETENESS]: 0.5,
      [AnswerMetric.CITATION_PRECISION]: 0,
      [AnswerMetric.CITATION_RECALL]: 0,
      [AnswerMetric.REFUSAL_ACCURACY]: 1,
      [AnswerMetric.ERROR_RATE]: 0,
      [AnswerMetric.LATENCY_P50_MS]: 3_000,
    });
    expect(agent.metrics).toMatchObject({
      [AnswerMetric.ANSWER_PRECISION]: 1,
      [AnswerMetric.COMPLETENESS]: 1,
      [AnswerMetric.CITATION_RECALL]: 1,
      [AnswerMetric.ERROR_RATE]: 0.5,
      [AnswerMetric.FALLBACK_RATE]: 0,
      [AnswerMetric.LATENCY_P95_MS]: 9_000,
    });
    expect(agent.tokens).toEqual({ meanInput: 1000, meanOutput: 200 });
    expect(agent.meanToolCalls).toBe(2);
    expect(result.samples.find((s) => s.mode === AnswerMode.AGENT && s.questionId === 'offtopic')?.error).toBe('HTTP 500');
  });

  it('records a judge failure on the sample without stopping the run', async () => {
    vi.mocked(judge.judge).mockRejectedValueOnce(new Error('judge 429'));
    const { result } = await run([AnswerMode.SINGLE_SHOT]);
    expect(result.samples[0].judgeError).toBe('judge 429');
    expect(result.samples[0].scores.answerPrecision).toBeNull();
    expect(result.samples).toHaveLength(2);
  });

  it('measures consistency across repeats', async () => {
    const { result } = await run([AnswerMode.AGENT], 3);
    expect(result.samples.filter((s) => s.questionId === 'mutex')).toHaveLength(3);
    expect(result.summaries[0].metrics[AnswerMetric.CONSISTENCY]).toBe(1);
  });

  it('counts agent requests that fell back to single-shot', async () => {
    const clock = fakeClock();
    const answerer: Answerer = {
      answer: async () => {
        clock.advance(1);
        return { text: 'x', model: 'm', attempts: 1, mode: AnswerMode.SINGLE_SHOT, fallbackReason: AgentFallbackReason.AGENT_FAILED };
      },
    };
    const result = await runAnswerEval([GOLDEN[0]], { answerer, judge, references, provider: 'openai', answerModel: 'm', now: clock.now }, { modes: [AnswerMode.AGENT], repeats: 1 });
    expect(result.summaries[0].metrics[AnswerMetric.FALLBACK_RATE]).toBe(1);
  });
});

describe('analyzeDrift', () => {
  it('flags metric regressions, per-question regressions, answer changes and data drift', async () => {
    const { result: before } = await run([AnswerMode.AGENT]);
    const baseline: AnswerEvalReport = {
      label: 'base', startedAt: '2026-10-01T00:00:00Z', durationMs: 1,
      settings: { answerModel: 'm', judgeModel: 'j', modes: [AnswerMode.AGENT], repeats: 1, questionCount: 2 },
      environment: { vaultFiles: 235, vaultIndexed: 235, vectorCount: 871, embeddingProvider: 'openai', pineconeIndex: 'idx' },
      ...before,
    };
    const degraded = before.samples.map((s) => (s.questionId === 'mutex'
      ? { ...s, text: 'Something else entirely', agent: { ...s.agent!, sourcesRead: ['other.md'] }, scores: { ...s.scores, f1: 0.3 } }
      : s));
    const current: AnswerEvalReport = {
      ...baseline,
      label: 'now',
      environment: { ...baseline.environment, vectorCount: 900 },
      samples: degraded,
      summaries: [{ ...before.summaries[0], metrics: { ...before.summaries[0].metrics, [AnswerMetric.F1]: 0.3 } }],
    };

    const drift = await analyzeDrift(baseline, current, embedder);

    expect(drift.environment).toEqual([{ field: 'vectorCount', baseline: 871, current: 900 }]);
    expect(drift.metrics.find((m) => m.metric === AnswerMetric.F1)?.status).toBe(DriftStatus.REGRESSED);
    const mutex = drift.questions.find((q) => q.questionId === 'mutex')!;
    expect(mutex).toMatchObject({ regressed: true, answerChanged: true, sourcesOverlap: 0 });
    expect(mutex.answerSimilarity).toBeCloseTo(0.6);
  });
});
