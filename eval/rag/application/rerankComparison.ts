import { applyHits, buildRerankRequest, fuseWithVectorOrder, truncate, type Reranker } from '../../../src/modules/rerank';
import type { CitedChunk } from '../../../src/types';
import type { RankedChunk } from '../domain';
import type { QueryRetriever, RetrievalReport } from './retrievalEvaluation';

export type ChunkSource = (question: string) => Promise<CitedChunk[]>;

export interface RerankLimits {
  maxQueryChars: number;
  maxDocumentChars: number;
}

export interface RerankTiming {
  calls: number;
  latenciesMs: number[];
  /** Documents (passages) sent per call. */
  documents: number[];
}

const toRanked = (score: (c: CitedChunk) => number) => (c: CitedChunk): RankedChunk => ({ source: c.source, heading: c.heading, score: score(c) });

/**
 * Two retrievers over ONE vector search per question: the cosine order, and
 * the same candidates reordered by the reranker with the production document
 * format (buildRerankDocument) and mapping (applyHits). Unlike production, a
 * reranker failure is NOT hidden by a fallback — the eval records it as an error.
 */
export function createRerankVariants(
  source: ChunkSource,
  reranker: Reranker,
  limits: RerankLimits,
  now: () => number = Date.now,
): { vector: QueryRetriever; reranked: QueryRetriever; fused: QueryRetriever; timing: RerankTiming } {
  const cache = new Map<string, Promise<CitedChunk[]>>();
  const candidates = (question: string) => {
    if (!cache.has(question)) cache.set(question, source(question));
    return cache.get(question)!;
  };
  const timing: RerankTiming = { calls: 0, latenciesMs: [], documents: [] };
  const rerankedCache = new Map<string, CitedChunk[]>();

  return {
    timing,
    vector: { retrieve: async (question) => (await candidates(question)).map(toRanked((c) => c.score ?? 0)) },
    reranked: {
      async retrieve(question) {
        const chunks = await candidates(question);
        if (chunks.length <= 1) return chunks.map(toRanked((c) => c.score ?? 0));
        const started = now();
        timing.calls++;
        const { documents, owners } = buildRerankRequest(chunks, limits.maxDocumentChars);
        const hits = await reranker.rerank(truncate(question.trim(), limits.maxQueryChars), documents, documents.length);
        timing.latenciesMs.push(now() - started);
        timing.documents.push(documents.length);
        const ranked = applyHits(chunks, hits, owners);
        rerankedCache.set(question, ranked);
        return ranked.map(toRanked((c) => c.rerankScore ?? 0));
      },
    },
    /** RRF of the reranked and vector orders; reuses the reranked result (run `reranked` first). */
    fused: {
      async retrieve(question) {
        const ranked = rerankedCache.get(question);
        if (!ranked) throw new Error('fused variant needs the reranked variant to run first');
        return fuseWithVectorOrder(ranked, await candidates(question)).map(toRanked((c) => c.rerankScore ?? 0));
      },
    },
  };
}

export interface RankChange {
  id: string;
  before: number | null;
  after: number | null;
}

export interface RerankComparison {
  metrics: Array<{ k: number; hitBefore: number; hitAfter: number; precisionBefore: number; precisionAfter: number; recallBefore: number; recallAfter: number }>;
  mrrBefore: number;
  mrrAfter: number;
  improved: RankChange[];
  worsened: RankChange[];
  unchanged: number;
}

/** Rank 1 beats rank 3; any rank beats a miss (null). */
const rankValue = (rank: number | null) => rank ?? Number.POSITIVE_INFINITY;

export function compareReports(before: RetrievalReport, after: RetrievalReport): RerankComparison {
  const afterById = new Map(after.results.map((r) => [r.id, r]));
  const improved: RankChange[] = [];
  const worsened: RankChange[] = [];
  let unchanged = 0;
  for (const b of before.results) {
    const a = afterById.get(b.id);
    if (!a || !b.answerable || b.error || a.error) continue;
    const change = { id: b.id, before: b.firstRelevantRank, after: a.firstRelevantRank };
    if (rankValue(change.after) < rankValue(change.before)) improved.push(change);
    else if (rankValue(change.after) > rankValue(change.before)) worsened.push(change);
    else unchanged++;
  }
  return {
    metrics: before.metrics.map((m, i) => ({
      k: m.k,
      hitBefore: m.hit,
      hitAfter: after.metrics[i]?.hit ?? 0,
      precisionBefore: m.precision,
      precisionAfter: after.metrics[i]?.precision ?? 0,
      recallBefore: m.recall,
      recallAfter: after.metrics[i]?.recall ?? 0,
    })),
    mrrBefore: before.mrr,
    mrrAfter: after.mrr,
    improved,
    worsened,
    unchanged,
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const delta = (a: number, b: number) => `${b - a >= 0 ? '+' : ''}${((b - a) * 100).toFixed(1)}`;
const rank = (r: number | null) => (r === null ? 'miss' : String(r));

export function formatComparison(comparison: RerankComparison, model: string, candidates: number, timing: RerankTiming, title = 'Rerank vs vector order'): string {
  const latencies = [...timing.latenciesMs].sort((x, y) => x - y);
  const p = (q: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(q * latencies.length) - 1)] : 0);
  return [
    `# ${title} — ${model}, ${candidates} candidates`,
    '',
    `- MRR: ${comparison.mrrBefore.toFixed(3)} → ${comparison.mrrAfter.toFixed(3)}`,
    `- Questions improved / worsened / unchanged: ${comparison.improved.length} / ${comparison.worsened.length} / ${comparison.unchanged}`,
    `- Rerank latency: p50 ${p(0.5)} ms · p95 ${p(0.95)} ms · max ${latencies.at(-1) ?? 0} ms (${timing.calls} calls, ${timing.documents.length ? Math.round(timing.documents.reduce((a, b) => a + b, 0) / timing.documents.length) : 0} passages/call)`,
    '',
    '| k | Hit@k vector | Hit@k rerank | Δ pts | Precision@k vector | Precision@k rerank | Δ pts | Recall@k rerank |',
    '|---|---|---|---|---|---|---|---|',
    ...comparison.metrics.map((m) =>
      `| ${m.k} | ${pct(m.hitBefore)} | ${pct(m.hitAfter)} | ${delta(m.hitBefore, m.hitAfter)} | ${pct(m.precisionBefore)} | ${pct(m.precisionAfter)} | ${delta(m.precisionBefore, m.precisionAfter)} | ${pct(m.recallAfter)} |`),
    '',
    '## First relevant rank changes',
    '| id | vector | rerank |',
    '|----|--------|--------|',
    ...[...comparison.improved, ...comparison.worsened].map((c) => `| ${c.id} | ${rank(c.before)} | ${rank(c.after)} |`),
  ].join('\n');
}
