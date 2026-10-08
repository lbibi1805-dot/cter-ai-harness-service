import {
  hitAtK,
  mean,
  precisionAtK,
  recallAtK,
  reciprocalRank,
  scoreStats,
  type GoldenItem,
  type RankedChunk,
  type ScoreStats,
} from '../domain';

/** Port: anything that returns ranked chunks for a question (production = Pinecone). */
export interface QueryRetriever {
  retrieve(question: string): Promise<RankedChunk[]>;
}

export interface MetricsAtK {
  k: number;
  hit: number;
  recall: number;
  precision: number;
}

export interface QuestionResult {
  id: string;
  question: string;
  answerable: boolean;
  expectedSources: string[];
  retrieved: RankedChunk[];
  reciprocalRank: number;
  /** Rank (1-based) of the first relevant chunk; null when missed. */
  firstRelevantRank: number | null;
  error?: string;
}

export interface RetrievalReport {
  label: string;
  startedAt: string;
  durationMs: number;
  questionCount: number;
  answerableCount: number;
  erroredCount: number;
  metrics: MetricsAtK[];
  mrr: number;
  /** Top-1 scores split by relevance — shows whether a score floor would separate them. */
  scores: {
    relevantTop1: ScoreStats | null;
    irrelevantTop1: ScoreStats | null;
    unanswerableTop1: ScoreStats | null;
  };
  /** Answerable questions whose expected file never appeared in the top max(k). */
  misses: string[];
  results: QuestionResult[];
}

/** Retrieves once per question at max(k), then derives every metric from that ranking. */
export async function evaluateRetrieval(
  items: GoldenItem[],
  retriever: QueryRetriever,
  kValues: readonly number[],
  label: string,
  onProgress: (done: number, total: number, item: GoldenItem) => void = () => undefined,
): Promise<RetrievalReport> {
  const startedAt = new Date();
  const results: QuestionResult[] = [];

  for (const [index, item] of items.entries()) {
    let retrieved: RankedChunk[] = [];
    let error: string | undefined;
    try {
      retrieved = await retriever.retrieve(item.question);
    } catch (err) {
      error = (err as Error).message;
    }
    const rr = reciprocalRank(retrieved, item.expectedSources);
    results.push({
      id: item.id,
      question: item.question,
      answerable: item.answerable,
      expectedSources: item.expectedSources,
      retrieved,
      reciprocalRank: rr,
      firstRelevantRank: rr > 0 ? Math.round(1 / rr) : null,
      error,
    });
    onProgress(index + 1, items.length, item);
  }

  const scored = results.filter((r) => r.answerable && !r.error);
  const metrics = kValues.map((k) => ({
    k,
    hit: mean(scored.map((r) => hitAtK(r.retrieved, r.expectedSources, k))),
    recall: mean(scored.map((r) => recallAtK(r.retrieved, r.expectedSources, k))),
    precision: mean(scored.map((r) => precisionAtK(r.retrieved, r.expectedSources, k))),
  }));

  const top1 = (r: QuestionResult) => r.retrieved[0]?.score;
  const topScores = (rs: QuestionResult[]) => rs.map(top1).filter((s): s is number => typeof s === 'number');

  return {
    label,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    questionCount: items.length,
    answerableCount: scored.length,
    erroredCount: results.filter((r) => r.error).length,
    metrics,
    mrr: mean(scored.map((r) => r.reciprocalRank)),
    scores: {
      relevantTop1: scoreStats(topScores(scored.filter((r) => r.firstRelevantRank === 1))),
      irrelevantTop1: scoreStats(topScores(scored.filter((r) => r.firstRelevantRank !== 1))),
      unanswerableTop1: scoreStats(topScores(results.filter((r) => !r.answerable && !r.error))),
    },
    misses: scored.filter((r) => r.firstRelevantRank === null).map((r) => r.id),
    results,
  };
}
