/** Direction of a metric: used to decide whether a change is an improvement or a regression. */
export enum MetricDirection {
  HIGHER_IS_BETTER = 'higher-is-better',
  LOWER_IS_BETTER = 'lower-is-better',
}

export enum DriftStatus {
  IMPROVED = 'improved',
  STABLE = 'stable',
  REGRESSED = 'regressed',
  /** Present in only one of the two runs. */
  UNCOMPARABLE = 'uncomparable',
}

/** Summary metrics reported per answer mode and compared across runs. */
export enum AnswerMetric {
  ANSWER_PRECISION = 'answerPrecision',
  COMPLETENESS = 'completeness',
  F1 = 'f1',
  RELEVANCE = 'relevance',
  CITATION_PRECISION = 'citationPrecision',
  CITATION_RECALL = 'citationRecall',
  REFUSAL_ACCURACY = 'refusalAccuracy',
  ERROR_RATE = 'errorRate',
  FALLBACK_RATE = 'fallbackRate',
  LATENCY_P50_MS = 'latencyP50Ms',
  LATENCY_P95_MS = 'latencyP95Ms',
  CONSISTENCY = 'consistency',
}

export const METRIC_DIRECTION: Record<AnswerMetric, MetricDirection> = {
  [AnswerMetric.ANSWER_PRECISION]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.COMPLETENESS]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.F1]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.RELEVANCE]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.CITATION_PRECISION]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.CITATION_RECALL]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.REFUSAL_ACCURACY]: MetricDirection.HIGHER_IS_BETTER,
  [AnswerMetric.ERROR_RATE]: MetricDirection.LOWER_IS_BETTER,
  [AnswerMetric.FALLBACK_RATE]: MetricDirection.LOWER_IS_BETTER,
  [AnswerMetric.LATENCY_P50_MS]: MetricDirection.LOWER_IS_BETTER,
  [AnswerMetric.LATENCY_P95_MS]: MetricDirection.LOWER_IS_BETTER,
  [AnswerMetric.CONSISTENCY]: MetricDirection.HIGHER_IS_BETTER,
};

/** Tolerances before a change counts as drift (absolute for ratios, relative for latency). */
export const DRIFT_THRESHOLDS = {
  /** Ratio metrics (0..1): an absolute change smaller than this is noise. */
  ratioAbs: 0.05,
  /** Latency: relative change smaller than this is noise. */
  latencyRel: 0.25,
  /** A question regressed when its F1 dropped by at least this much. */
  questionF1Drop: 0.2,
  /** Answers whose embedding similarity to the baseline answer is below this "changed meaning". */
  answerSimilarity: 0.85,
} as const;

/** The phrase the system prompt asks models to use when the vault has no answer. */
export const REFUSAL_PATTERN = /do(?:es)? not contain information|not (?:covered|found) in the (?:provided )?documents/i;
