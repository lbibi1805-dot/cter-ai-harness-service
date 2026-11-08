import * as fs from 'fs';
import * as path from 'path';
import { EVAL_BASELINE_FILE, EVAL_RESULT_EXTENSION } from '../domain/constants/goldenEval.constants';
import type { EvalResultEntry } from '../domain/interfaces/goldenEval.interface';

interface StoredRun {
  promptVersion?: string;
  date?: string;
  meanScore?: number;
  passRate?: number;
}

function readRun(dir: string, file: string): StoredRun | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as StoredRun;
  } catch {
    return null;
  }
}

/**
 * `GET /api/evals`: one row per `evals/results/<date>-<promptVersion>.json` written by `npm run eval`,
 * newest first, with the delta against `baseline.json`. Reads local files only (deployed with the image,
 * or empty) — never Neon/R2. Unreadable files are skipped.
 */
export function listEvalResults(resultsDir: string): EvalResultEntry[] {
  if (!fs.existsSync(resultsDir)) return [];
  const baseline = readRun(resultsDir, EVAL_BASELINE_FILE);
  const baselineScore = typeof baseline?.meanScore === 'number' ? baseline.meanScore : null;
  const rows: EvalResultEntry[] = [];
  for (const file of fs.readdirSync(resultsDir)) {
    if (!file.endsWith(EVAL_RESULT_EXTENSION) || file === EVAL_BASELINE_FILE) continue;
    const run = readRun(resultsDir, file);
    if (!run || typeof run.meanScore !== 'number') continue;
    rows.push({
      file,
      date: run.date ?? null,
      promptVersion: run.promptVersion ?? null,
      score: run.meanScore,
      passRate: run.passRate ?? null,
      baseline: baselineScore,
      delta: baselineScore === null ? null : run.meanScore - baselineScore,
    });
  }
  return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.file.localeCompare(a.file));
}
