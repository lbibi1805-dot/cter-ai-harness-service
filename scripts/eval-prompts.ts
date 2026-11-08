// Golden eval for prompt changes (06 §2.3): run before merging any change under prompts/.
// Usage: npm run eval [-- --judge] [-- --only T01,T02]
// Needs a RUNNING harness: HARNESS_URL (e.g. http://localhost:3000) + CHAT_API_TOKEN. Without them it is skipped.
// Optional: EVAL_PROVIDER (default gemini), EVAL_MODEL, EVAL_JUDGE_PROVIDER / EVAL_JUDGE_MODEL (with --judge).
// Each case costs one /api/chat call (plus one with --judge): keep the golden set small; never point it at prod.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { readPromptConfig } from '../src/bootstrap/config/readers/promptConfig.reader';
import { mean, scoreGoldenCase, type GoldenAnswer, type GoldenCase, type GoldenRunSummary, type GoldenScore } from '../src/modules/prompts';

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_DIR = path.join(ROOT, 'evals', 'golden');
const RESULTS_DIR = path.join(ROOT, 'evals', 'results');
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline.json');
const CHAT_PATH = '/api/chat';
const DEFAULT_PROVIDER = 'gemini';
const JUDGE_FLAG = '--judge';
const ONLY_FLAG = '--only';
const JUDGE_SCALE = 10;
const PERCENT = 100;
/** Scored by scripts/eval-essay.ts (npm run eval:essay), not by this rule set. */
const ESSAY_GOLDEN_FILES = new Set(['essay.jsonl']);
const JUDGE_SCORE = /\b(10|[0-9])(?:\s*\/\s*10)?\b/;

function readGoldenCases(): GoldenCase[] {
  if (!fs.existsSync(GOLDEN_DIR)) return [];
  return fs.readdirSync(GOLDEN_DIR)
    .filter((name) => name.endsWith('.jsonl') && !ESSAY_GOLDEN_FILES.has(name))
    .sort()
    .flatMap((name) => fs.readFileSync(path.join(GOLDEN_DIR, name), 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line, i) => {
        try {
          return JSON.parse(line) as GoldenCase;
        } catch {
          throw new Error(`${name}:${i + 1} is not valid JSON`);
        }
      }))
    // Other golden sets live in the same folder (reference-resolution.jsonl is scored offline by a vitest).
    .filter((testCase) => Array.isArray(testCase.expected_points));
}

async function ask(baseUrl: string, token: string, body: Record<string, unknown>): Promise<GoldenAnswer> {
  const response = await fetch(new URL(CHAT_PATH, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json() as GoldenAnswer & { error?: string };
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${json.error ?? 'unknown error'}`);
  return json;
}

async function judge(baseUrl: string, token: string, testCase: GoldenCase, answer: GoldenAnswer): Promise<number | undefined> {
  const prompt = [
    'You are grading an exam answer. Reply with one integer from 0 to 10 and nothing else.',
    `Question: ${testCase.question}`,
    `Expected points: ${testCase.expected_points.join('; ')}`,
    `Answer:\n${answer.text}`,
  ].join('\n\n');
  const reply = await ask(baseUrl, token, {
    provider: process.env.EVAL_JUDGE_PROVIDER ?? process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER,
    ...(process.env.EVAL_JUDGE_MODEL ? { model: process.env.EVAL_JUDGE_MODEL } : {}),
    question: prompt,
  });
  const match = JUDGE_SCORE.exec(reply.text);
  return match ? Number(match[1]) / JUDGE_SCALE : undefined;
}

function pct(value: number): string {
  return `${(value * PERCENT).toFixed(0)}%`;
}

function printComparison(summary: GoldenRunSummary): void {
  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf-8')) as GoldenRunSummary : null;
  const before = new Map((baseline?.results ?? []).map((result) => [result.id, result]));
  console.table(summary.results.map((result) => ({
    id: result.id,
    score: pct(result.score),
    baseline: before.has(result.id) ? pct(before.get(result.id)!.score) : '-',
    pass: result.pass,
    missing: result.missingPoints.join(', '),
    refs: result.hasReferencesSection,
    ...(result.judge !== undefined ? { judge: pct(result.judge) } : {}),
  })));
  console.log(`mean ${pct(summary.meanScore)} · pass ${pct(summary.passRate)} · promptVersion ${summary.promptVersion}`);
  if (baseline) {
    const delta = summary.meanScore - baseline.meanScore;
    console.log(`baseline ${baseline.promptVersion}: mean ${pct(baseline.meanScore)} → ${delta >= 0 ? '+' : ''}${pct(delta)}${delta < 0 ? '  ⚠ BELOW BASELINE' : ''}`);
  } else {
    console.log(`no baseline: copy this result to ${path.relative(ROOT, BASELINE_FILE)} to compare future runs`);
  }
}

async function main(): Promise<void> {
  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  if (!baseUrl || !token) {
    console.log('eval skipped: set HARNESS_URL and CHAT_API_TOKEN (a running harness, never prod) to run the golden set.');
    return;
  }
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf(ONLY_FLAG);
  const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').filter(Boolean)) : null;
  const cases = readGoldenCases().filter((testCase) => !only || only.has(testCase.id));
  if (!cases.length) {
    console.log(`eval skipped: no cases in ${path.relative(ROOT, GOLDEN_DIR)}/*.jsonl`);
    return;
  }

  const { promptVersion = 'unknown' } = readPromptConfig();
  const provider = process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER;
  const model = process.env.EVAL_MODEL;
  const useJudge = args.includes(JUDGE_FLAG);
  /** Latency of each case (for evals/reports notebooks): wall clock + server `timings`. */
  const results: Array<GoldenScore & { wallMs?: number; timings?: unknown }> = [];
  for (const testCase of cases) {
    const started = Date.now();
    try {
      const answer = await ask(baseUrl, token, {
        provider: testCase.provider ?? provider,
        ...(model ? { model } : {}),
        ...(testCase.mode ? { mode: testCase.mode } : {}),
        question: testCase.question,
      });
      const score = scoreGoldenCase(testCase, answer);
      if (useJudge) score.judge = await judge(baseUrl, token, testCase, answer);
      results.push({ ...score, wallMs: Date.now() - started, timings: (answer as GoldenAnswer & { timings?: unknown }).timings });
      console.log(`${testCase.id}: ${pct(score.score)}${score.pass ? '' : ' (fail)'}`);
    } catch (error) {
      console.error(`${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ ...scoreGoldenCase(testCase, { text: '' }), pass: false });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const summary: GoldenRunSummary = {
    promptVersion,
    date,
    provider,
    ...(model ? { model } : {}),
    meanScore: mean(results.map((result) => result.score)),
    passRate: mean(results.map((result) => (result.pass ? 1 : 0))),
    results,
  };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `${date}-${promptVersion}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`saved ${path.relative(ROOT, outFile)}`);
  printComparison(summary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
