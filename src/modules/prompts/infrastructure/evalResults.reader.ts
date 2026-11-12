import * as fs from 'fs';
import * as path from 'path';
import { EVAL_BASELINE_FILE, EVAL_RESULT_EXTENSION } from '../domain/constants/goldenEval.constants';
import type { EvalResultEntry } from '../domain/interfaces/goldenEval.interface';
import { EvalKind } from '../domain/enums/prompt.enums';

interface StoredRun {
  /** `rule-compliance` for `npm run eval:rules`; absent = golden QA (`npm run eval`). */
  kind?: string;
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
    const kind = run.kind ?? EvalKind.GOLDEN_QA;
    // The QA baseline only compares with QA runs (rule-compliance has its own target, 12/11 02 Bước 7).
    const comparable = kind === EvalKind.GOLDEN_QA ? baselineScore : null;
    rows.push({
      file,
      kind,
      date: run.date ?? null,
      promptVersion: run.promptVersion ?? null,
      score: run.meanScore,
      passRate: run.passRate ?? null,
      baseline: comparable,
      delta: comparable === null ? null : run.meanScore - comparable,
    });
  }
  return rows.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.file.localeCompare(a.file));
}
