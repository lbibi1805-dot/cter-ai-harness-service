import {
  DRIFT_THRESHOLDS,
  compareEnvironment,
  compareSummaries,
  cosineSimilarity,
  jaccard,
  type AnswerEvalReport,
  type DriftReport,
  type QuestionDrift,
  type ScoredSample,
} from '../domain';
import type { TextEmbedder } from './ports';

/**
 * Compares a run with a baseline run: metric drift per mode, data drift
 * (vault/index changes), and per-question drift (score drop, how much the
 * answer text changed in meaning, which sources were used).
 */
export async function analyzeDrift(baseline: AnswerEvalReport, current: AnswerEvalReport, embedder?: TextEmbedder): Promise<DriftReport> {
  const questions: QuestionDrift[] = [];
  for (const now of firstRepeats(current.samples)) {
    const before = firstRepeats(baseline.samples).find((s) => s.questionId === now.questionId && s.mode === now.mode);
    if (!before) continue;

    const f1Delta = now.scores.f1 !== null && before.scores.f1 !== null ? now.scores.f1 - before.scores.f1 : null;
    const answerSimilarity = embedder && now.text && before.text
      ? cosineSimilarity(await embedder.embed(before.text), await embedder.embed(now.text))
      : null;
    questions.push({
      questionId: now.questionId,
      mode: now.mode,
      f1Delta,
      answerSimilarity,
      sourcesOverlap: jaccard(sourcesOf(before), sourcesOf(now)),
      regressed: f1Delta !== null && f1Delta <= -DRIFT_THRESHOLDS.questionF1Drop,
      answerChanged: answerSimilarity !== null && answerSimilarity < DRIFT_THRESHOLDS.answerSimilarity,
    });
  }

  return {
    baselineLabel: baseline.label,
    baselineStartedAt: baseline.startedAt,
    environment: compareEnvironment(baseline.environment, current.environment),
    metrics: compareSummaries(baseline.summaries, current.summaries),
    questions,
  };
}

function firstRepeats(samples: ScoredSample[]): ScoredSample[] {
  return samples.filter((s) => s.repeat === 1);
}

/** Agent: files it actually read; single-shot: files it cited. */
function sourcesOf(sample: ScoredSample): string[] {
  return sample.agent?.sourcesRead.length ? sample.agent.sourcesRead : sample.citedSources;
}
