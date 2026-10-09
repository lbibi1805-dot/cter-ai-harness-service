import {
  AnswerMetric,
  DRIFT_THRESHOLDS,
  DriftStatus,
  METRIC_DIRECTION,
  MetricDirection,
} from './answerEval.enums';
import type { EnvironmentSnapshot, MetricDrift, ModeSummary } from './answerEval.types';

const LATENCY_METRICS = new Set<AnswerMetric>([AnswerMetric.LATENCY_P50_MS, AnswerMetric.LATENCY_P95_MS]);

/** Classifies one metric change using its direction and the noise thresholds. */
export function classifyDrift(metric: AnswerMetric, baseline: number | null | undefined, current: number | null | undefined): Omit<MetricDrift, 'mode' | 'metric'> {
  if (baseline === null || baseline === undefined || current === null || current === undefined) {
    return { baseline: baseline ?? null, current: current ?? null, delta: null, status: DriftStatus.UNCOMPARABLE };
  }
  const delta = current - baseline;
  const significant = LATENCY_METRICS.has(metric)
    ? baseline > 0 && Math.abs(delta) / baseline >= DRIFT_THRESHOLDS.latencyRel
    : Math.abs(delta) >= DRIFT_THRESHOLDS.ratioAbs;
  if (!significant) return { baseline, current, delta, status: DriftStatus.STABLE };
  const better = METRIC_DIRECTION[metric] === MetricDirection.HIGHER_IS_BETTER ? delta > 0 : delta < 0;
  return { baseline, current, delta, status: better ? DriftStatus.IMPROVED : DriftStatus.REGRESSED };
}

export function compareSummaries(baseline: ModeSummary[], current: ModeSummary[]): MetricDrift[] {
  const drifts: MetricDrift[] = [];
  for (const now of current) {
    const before = baseline.find((s) => s.mode === now.mode);
    for (const metric of Object.values(AnswerMetric)) {
      const result = classifyDrift(metric, before?.metrics[metric], now.metrics[metric]);
      if (result.baseline === null && result.current === null) continue;
      drifts.push({ mode: now.mode, metric, ...result });
    }
  }
  return drifts;
}

/** Data drift: did the corpus or index change between the runs? */
export function compareEnvironment(baseline: EnvironmentSnapshot, current: EnvironmentSnapshot) {
  return (Object.keys(current) as Array<keyof EnvironmentSnapshot>)
    .filter((field) => baseline[field] !== current[field])
    .map((field) => ({ field, baseline: baseline[field], current: current[field] }));
}
