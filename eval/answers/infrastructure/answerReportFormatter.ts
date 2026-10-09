import { AnswerMetric, DriftStatus, type AnswerEvalReport, type ModeSummary } from '../domain';

const RATIO_METRICS: AnswerMetric[] = [
  AnswerMetric.ANSWER_PRECISION, AnswerMetric.COMPLETENESS, AnswerMetric.F1, AnswerMetric.RELEVANCE,
  AnswerMetric.CITATION_PRECISION, AnswerMetric.CITATION_RECALL, AnswerMetric.REFUSAL_ACCURACY,
  AnswerMetric.ERROR_RATE, AnswerMetric.FALLBACK_RATE, AnswerMetric.CONSISTENCY,
];
const STATUS_ICON: Record<DriftStatus, string> = {
  [DriftStatus.IMPROVED]: '▲ improved',
  [DriftStatus.REGRESSED]: '▼ REGRESSED',
  [DriftStatus.STABLE]: '= stable',
  [DriftStatus.UNCOMPARABLE]: '— n/a',
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const ms = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${(v / 1000).toFixed(1)}s`);
const num = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : v.toFixed(digits));

function metricValue(metric: AnswerMetric, value: number | null | undefined): string {
  return metric === AnswerMetric.LATENCY_P50_MS || metric === AnswerMetric.LATENCY_P95_MS ? ms(value) : pct(value);
}

function summaryTable(summaries: ModeSummary[]): string[] {
  const header = ['Metric', ...summaries.map((s) => s.mode)];
  const rows: string[][] = [
    ...RATIO_METRICS.map((m) => [m, ...summaries.map((s) => pct(s.metrics[m]))]),
    ['latency mean', ...summaries.map((s) => ms(s.latency?.mean))],
    ['latency p50', ...summaries.map((s) => ms(s.latency?.p50))],
    ['latency p95', ...summaries.map((s) => ms(s.latency?.p95))],
    ['latency max', ...summaries.map((s) => ms(s.latency?.max))],
    ['agent tool calls (mean)', ...summaries.map((s) => num(s.meanToolCalls, 1))],
    ['agent tokens in/out (mean)', ...summaries.map((s) => (s.tokens ? `${num(s.tokens.meanInput)}/${num(s.tokens.meanOutput)}` : '—'))],
    ['samples', ...summaries.map((s) => String(s.samples))],
  ];
  return [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

export function formatAnswerReport(report: AnswerEvalReport): string {
  const lines: string[] = [
    `# Answer eval — ${report.label}`,
    '',
    `- Started: ${report.startedAt} (${(report.durationMs / 60_000).toFixed(1)} min)`,
    `- Answer model: ${report.settings.answerModel} · Judge: ${report.settings.judgeModel} · Repeats: ${report.settings.repeats} · Questions: ${report.settings.questionCount}`,
    `- Vault: ${report.environment.vaultFiles ?? '?'} files (${report.environment.vaultIndexed ?? '?'} indexed) · Pinecone ${report.environment.pineconeIndex}: ${report.environment.vectorCount ?? '?'} vectors (${report.environment.embeddingProvider})`,
    '',
    '## Summary by mode',
    '',
    ...summaryTable(report.summaries),
    '',
    '_answerPrecision = supported claims / all claims (judged against the expected source documents). completeness = key points covered. citation* compare the References section with expected_sources._',
  ];

  if (report.drift) {
    const d = report.drift;
    lines.push('', `## Drift vs ${d.baselineLabel} (${d.baselineStartedAt})`, '');
    lines.push(d.environment.length
      ? `**Data drift:** ${d.environment.map((e) => `${e.field} ${String(e.baseline)} → ${String(e.current)}`).join('; ')}`
      : 'Data drift: none (vault and index unchanged).');
    lines.push('', '| Mode | Metric | Baseline | Current | Status |', '|---|---|---|---|---|');
    for (const m of d.metrics.filter((x) => x.status !== DriftStatus.STABLE)) {
      lines.push(`| ${m.mode} | ${m.metric} | ${metricValue(m.metric, m.baseline)} | ${metricValue(m.metric, m.current)} | ${STATUS_ICON[m.status]} |`);
    }
    if (d.metrics.every((m) => m.status === DriftStatus.STABLE)) lines.push('| — | all metrics | | | = stable |');
    const flagged = d.questions.filter((q) => q.regressed || q.answerChanged);
    lines.push('', `**Questions regressed or changed meaning:** ${flagged.length}/${d.questions.length}`);
    for (const q of flagged) {
      lines.push(`- ${q.questionId} [${q.mode}] ΔF1 ${num(q.f1Delta, 2)} · similarity ${num(q.answerSimilarity, 2)} · sources overlap ${num(q.sourcesOverlap, 2)}${q.regressed ? ' · REGRESSED' : ''}`);
    }
  }

  lines.push('', '## Per question', '', '| id | mode | latency | precision | completeness | citations P/R | refusal ok | notes |', '|---|---|---|---|---|---|---|---|');
  for (const s of report.samples) {
    const notes = s.error ? `ERROR: ${s.error}` : s.judgeError ? `JUDGE ERROR: ${s.judgeError}` : [s.fallbackReason ? `fallback: ${s.fallbackReason}` : '', s.verdict?.notes ?? ''].filter(Boolean).join(' · ');
    lines.push(`| ${s.questionId}${s.repeat > 1 ? `#${s.repeat}` : ''} | ${s.mode} | ${ms(s.latencyMs)} | ${pct(s.scores.answerPrecision)} | ${pct(s.scores.completeness)} | ${pct(s.scores.citationPrecision)}/${pct(s.scores.citationRecall)} | ${s.scores.refusalCorrect === null ? '—' : s.scores.refusalCorrect ? 'yes' : 'NO'} | ${notes.replace(/\|/g, '/')} |`);
  }
  return lines.join('\n');
}
