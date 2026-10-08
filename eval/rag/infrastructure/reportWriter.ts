import * as fs from 'fs';
import * as path from 'path';
import type { RetrievalReport } from '../application/retrievalEvaluation';
import type { ScoreStats } from '../domain';

export const DEFAULT_RUNS_DIR = path.resolve(__dirname, '..', 'runs');

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const stat = (s: ScoreStats | null) => (s ? `n=${s.count} min=${s.min.toFixed(3)} median=${s.median.toFixed(3)} max=${s.max.toFixed(3)}` : '—');

export function formatReport(report: RetrievalReport): string {
  const lines = [
    `# RAG retrieval eval — ${report.label}`,
    '',
    `- Started: ${report.startedAt} (${(report.durationMs / 1000).toFixed(1)}s)`,
    `- Questions: ${report.questionCount} (${report.answerableCount} answerable scored, ${report.erroredCount} errored)`,
    `- MRR: ${report.mrr.toFixed(3)}`,
    '',
    '| k | Hit@k | Recall@k | Precision@k |',
    '|---|-------|----------|-------------|',
    ...report.metrics.map((m) => `| ${m.k} | ${percent(m.hit)} | ${percent(m.recall)} | ${percent(m.precision)} |`),
    '',
    '## Top-1 similarity scores',
    `- Relevant top-1:     ${stat(report.scores.relevantTop1)}`,
    `- Irrelevant top-1:   ${stat(report.scores.irrelevantTop1)}`,
    `- Unanswerable top-1: ${stat(report.scores.unanswerableTop1)}`,
    '',
    '## Per question',
    '| id | first relevant rank | top-3 retrieved files |',
    '|----|---------------------|------------------------|',
    ...report.results.map((r) => {
      const rank = r.error ? `ERROR: ${r.error}` : !r.answerable ? 'n/a (unanswerable)' : r.firstRelevantRank ?? '**MISS**';
      const top3 = [...new Set(r.retrieved.map((c) => c.source))].slice(0, 3).join('<br>');
      return `| ${r.id} | ${rank} | ${top3} |`;
    }),
  ];
  return lines.join('\n');
}

/** Writes `<runs>/<timestamp>-<label>.json` (full data) and `.md` (summary). */
export function writeReport(report: RetrievalReport, runsDir: string = DEFAULT_RUNS_DIR): { json: string; markdown: string } {
  fs.mkdirSync(runsDir, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const base = path.join(runsDir, `${stamp}-${report.label.replace(/[^\w.-]+/g, '_')}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${base}.md`, formatReport(report));
  return { json: `${base}.json`, markdown: `${base}.md` };
}
