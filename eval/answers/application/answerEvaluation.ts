import { AnswerMode, type Answerer } from '../../../src/modules/agent/domain';
import type { GoldenItem } from '../../rag/domain';
import {
  AnswerMetric,
  cosineSimilarity,
  latencyStats,
  meanOf,
  parseCitedSources,
  scoreSample,
  type AnswerSample,
  type ModeSummary,
  type ScoredSample,
} from '../domain';
import type { AnswerJudge, ReferenceLoader, TextEmbedder } from './ports';

export interface AnswerEvalDeps {
  answerer: Answerer;
  judge: AnswerJudge;
  references: ReferenceLoader;
  /** Needed for the consistency metric when repeats > 1. */
  embedder?: TextEmbedder;
  provider: 'openai';
  answerModel: string;
  now?: () => number;
}

export interface AnswerEvalOptions {
  modes: AnswerMode[];
  repeats: number;
  onProgress?: (done: number, total: number, label: string) => void;
}

export interface AnswerEvalResult {
  samples: ScoredSample[];
  summaries: ModeSummary[];
}

/**
 * Asks every golden question in every mode (× repeats) through the production
 * answer path, times it, grades it, and aggregates per mode. One failing
 * answer or grading never stops the run — it is recorded on the sample.
 */
export async function runAnswerEval(items: GoldenItem[], deps: AnswerEvalDeps, options: AnswerEvalOptions): Promise<AnswerEvalResult> {
  const now = deps.now ?? Date.now;
  const total = items.length * options.modes.length * options.repeats;
  const samples: ScoredSample[] = [];
  const referenceCache = new Map<string, string>();

  for (const item of items) {
    const referenceText = await loadReferences(item, deps.references, referenceCache);
    for (const mode of options.modes) {
      for (let repeat = 1; repeat <= options.repeats; repeat++) {
        const sample = await answerOnce(item, mode, repeat, deps, now);
        samples.push(await grade(item, sample, referenceText, deps.judge));
        options.onProgress?.(samples.length, total, `${item.id} [${mode}] #${repeat}`);
      }
    }
  }

  const summaries: ModeSummary[] = [];
  for (const mode of options.modes) {
    const ofMode = samples.filter((s) => s.mode === mode);
    summaries.push(await summarize(mode, ofMode, items, options.repeats, deps.embedder));
  }
  return { samples, summaries };
}

async function loadReferences(item: GoldenItem, loader: ReferenceLoader, cache: Map<string, string>): Promise<string> {
  if (item.expectedSources.length === 0) return '';
  const key = item.expectedSources.join('|');
  if (!cache.has(key)) cache.set(key, await loader.load(item.expectedSources));
  return cache.get(key)!;
}

async function answerOnce(item: GoldenItem, mode: AnswerMode, repeat: number, deps: AnswerEvalDeps, now: () => number): Promise<AnswerSample> {
  const started = now();
  try {
    const result = await deps.answerer.answer({
      provider: deps.provider,
      model: deps.answerModel,
      content: { textContent: item.question, imageBuffers: [] },
      label: `eval:${item.id}`,
      mode,
    });
    return {
      questionId: item.id,
      mode,
      repeat,
      text: result.text,
      model: result.model,
      latencyMs: now() - started,
      answeredBy: result.mode,
      fallbackReason: result.fallbackReason,
      agent: result.agent,
      citedSources: parseCitedSources(result.text),
    };
  } catch (err) {
    return { questionId: item.id, mode, repeat, text: '', model: deps.answerModel, latencyMs: now() - started, error: (err as Error).message, citedSources: [] };
  }
}

async function grade(item: GoldenItem, sample: AnswerSample, referenceText: string, judge: AnswerJudge): Promise<ScoredSample> {
  if (sample.error) return { ...sample, scores: scoreSample(item, undefined, sample.citedSources) };
  try {
    const verdict = await judge.judge({ item, answer: sample.text, referenceText });
    return { ...sample, verdict, scores: scoreSample(item, verdict, sample.citedSources) };
  } catch (err) {
    return { ...sample, judgeError: (err as Error).message, scores: scoreSample(item, undefined, sample.citedSources) };
  }
}

async function summarize(mode: AnswerMode, samples: ScoredSample[], items: GoldenItem[], repeats: number, embedder?: TextEmbedder): Promise<ModeSummary> {
  const ok = samples.filter((s) => !s.error);
  const scores = ok.map((s) => s.scores);
  const refusal = scores.map((s) => s.refusalCorrect).filter((v): v is boolean => v !== null);
  const latency = latencyStats(ok.map((s) => s.latencyMs));
  const agentRuns = ok.filter((s) => s.agent);
  const fallbacks = mode === AnswerMode.AGENT ? ok.filter((s) => s.answeredBy !== AnswerMode.AGENT).length : 0;

  return {
    mode,
    samples: samples.length,
    metrics: {
      [AnswerMetric.ANSWER_PRECISION]: meanOf(scores.map((s) => s.answerPrecision)),
      [AnswerMetric.COMPLETENESS]: meanOf(scores.map((s) => s.completeness)),
      [AnswerMetric.F1]: meanOf(scores.map((s) => s.f1)),
      [AnswerMetric.RELEVANCE]: meanOf(scores.map((s) => s.relevance)),
      [AnswerMetric.CITATION_PRECISION]: meanOf(scores.map((s) => s.citationPrecision)),
      [AnswerMetric.CITATION_RECALL]: meanOf(scores.map((s) => s.citationRecall)),
      [AnswerMetric.REFUSAL_ACCURACY]: refusal.length ? refusal.filter(Boolean).length / refusal.length : null,
      [AnswerMetric.ERROR_RATE]: samples.length ? (samples.length - ok.length) / samples.length : null,
      [AnswerMetric.FALLBACK_RATE]: mode === AnswerMode.AGENT && ok.length ? fallbacks / ok.length : null,
      [AnswerMetric.LATENCY_P50_MS]: latency?.p50 ?? null,
      [AnswerMetric.LATENCY_P95_MS]: latency?.p95 ?? null,
      [AnswerMetric.CONSISTENCY]: repeats > 1 && embedder ? await consistency(ok, items, embedder) : null,
    },
    latency,
    tokens: agentRuns.length
      ? { meanInput: meanOf(agentRuns.map((s) => s.agent!.usage.inputTokens)) ?? 0, meanOutput: meanOf(agentRuns.map((s) => s.agent!.usage.outputTokens)) ?? 0 }
      : null,
    meanToolCalls: agentRuns.length ? meanOf(agentRuns.map((s) => s.agent!.toolCalls)) : null,
  };
}

/** Mean pairwise cosine similarity between repeated answers to the same question. */
async function consistency(samples: ScoredSample[], items: GoldenItem[], embedder: TextEmbedder): Promise<number | null> {
  const perQuestion: number[] = [];
  for (const item of items) {
    const texts = samples.filter((s) => s.questionId === item.id && s.text).map((s) => s.text);
    if (texts.length < 2) continue;
    const vectors = await Promise.all(texts.map((t) => embedder.embed(t)));
    const sims: number[] = [];
    for (let i = 0; i < vectors.length; i++) for (let j = i + 1; j < vectors.length; j++) sims.push(cosineSimilarity(vectors[i], vectors[j]));
    perQuestion.push(sims.reduce((s, v) => s + v, 0) / sims.length);
  }
  return meanOf(perQuestion);
}
