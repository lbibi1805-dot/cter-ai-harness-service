import * as fs from 'fs';
import * as path from 'path';
import type { AnswerEvalReport } from '../domain';
import { formatAnswerReport } from './answerReportFormatter';

export const DEFAULT_ANSWER_RUNS_DIR = path.resolve(__dirname, '..', 'runs');
export const LATEST_BASELINE = 'latest';

export function saveAnswerReport(report: AnswerEvalReport, runsDir = DEFAULT_ANSWER_RUNS_DIR): { json: string; markdown: string } {
  fs.mkdirSync(runsDir, { recursive: true });
  const base = path.join(runsDir, `${report.startedAt.replace(/[:.]/g, '-')}-${report.label.replace(/[^\w.-]+/g, '_')}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${base}.md`, formatAnswerReport(report));
  return { json: `${base}.json`, markdown: `${base}.md` };
}

/** `latest` = most recent saved run; otherwise a path to a run JSON. Null when none exists. */
export function loadBaseline(reference: string, runsDir = DEFAULT_ANSWER_RUNS_DIR): AnswerEvalReport | null {
  let file = reference;
  if (reference === LATEST_BASELINE) {
    if (!fs.existsSync(runsDir)) return null;
    const runs = fs.readdirSync(runsDir).filter((f) => f.endsWith('.json')).sort();
    if (runs.length === 0) return null;
    file = path.join(runsDir, runs[runs.length - 1]);
  }
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf-8')) as AnswerEvalReport;
}
