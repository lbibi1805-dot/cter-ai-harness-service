// Golden essay eval (15 §5): Essay Mode answers scored by rules (must_terms, length vs target, valid citation ids,
// aspect coverage, must_cite) plus an optional LLM judge on the 6 radar criteria (1–5).
// Usage: npm run eval:essay [-- --judge] [-- --only E01,E02]
// Needs a RUNNING harness: HARNESS_URL (e.g. http://localhost:3000) + CHAT_API_TOKEN. Without them it is skipped.
// Optional: EVAL_PROVIDER (default gemini), EVAL_MODEL, EVAL_JUDGE_PROVIDER / EVAL_JUDGE_MODEL (use a model other than the writer).
// Each case costs 2–3 LLM calls (plus one with --judge): keep the set small; never point it at prod.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { mean } from '../src/modules/prompts';
import { ESSAY_JUDGE_CRITERIA, scoreEssayCase, type EssayGoldenAnswer, type EssayGoldenCase, type EssayGoldenScore } from '../src/modules/essay';

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_FILE = path.join(ROOT, 'evals', 'golden', 'essay.jsonl');
const RESULTS_DIR = path.join(ROOT, 'evals', 'results');
const CHAT_PATH = '/api/chat';
const DEFAULT_PROVIDER = 'gemini';
const ESSAY_MODE = 'essay';
const JUDGE_FLAG = '--judge';
const ONLY_FLAG = '--only';
const PERCENT = 100;
const JSON_OBJECT = /\{[\s\S]*\}/;
const JUDGE_MIN = 1;
const JUDGE_MAX = 5;

function readCases(): EssayGoldenCase[] {
  if (!fs.existsSync(GOLDEN_FILE)) return [];
  return fs.readFileSync(GOLDEN_FILE, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, i) => {
      try {
        return JSON.parse(line) as EssayGoldenCase;
      } catch {
        throw new Error(`essay.jsonl:${i + 1} is not valid JSON`);
      }
    });
}

async function ask(baseUrl: string, token: string, body: Record<string, unknown>): Promise<EssayGoldenAnswer> {
  const response = await fetch(new URL(CHAT_PATH, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json() as EssayGoldenAnswer & { error?: string };
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${json.error ?? 'unknown error'}`);
  return json;
}

async function judge(baseUrl: string, token: string, testCase: EssayGoldenCase, answer: EssayGoldenAnswer): Promise<Record<string, number> | undefined> {
  const prompt = [
    `You grade an exam essay. Score each criterion from ${JUDGE_MIN} to ${JUDGE_MAX}. Reply with ONE JSON object only:`,
    `{${ESSAY_JUDGE_CRITERIA.map((criterion) => `"${criterion}": n`).join(', ')}}`,
    'coverage = every aspect answered; terminology = course terms used correctly; structure = intro/body per aspect/conclusion;',
    'reasoning = arguments and concrete examples; citations = claims grounded in the outline sources; length = close to target_words.',
    `Question: ${testCase.question}`,
    `Aspects: ${testCase.aspects.join('; ')}`,
    `target_words: ${testCase.target_words}`,
    `Outline:\n${answer.essay?.outline ?? '(none)'}`,
    `Essay:\n${answer.text}`,
  ].join('\n\n');
  const reply = await ask(baseUrl, token, {
    provider: process.env.EVAL_JUDGE_PROVIDER ?? process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER,
    ...(process.env.EVAL_JUDGE_MODEL ? { model: process.env.EVAL_JUDGE_MODEL } : {}),
    question: prompt,
  });
  const match = JSON_OBJECT.exec(reply.text);
  if (!match) return undefined;
  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  const scores: Record<string, number> = {};
  for (const criterion of ESSAY_JUDGE_CRITERIA) {
    const value = Number(parsed[criterion]);
    if (Number.isFinite(value)) scores[criterion] = Math.min(JUDGE_MAX, Math.max(JUDGE_MIN, value));
  }
  return scores;
}

function pct(value: number): string {
  return `${(value * PERCENT).toFixed(0)}%`;
}

async function main(): Promise<void> {
  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  if (!baseUrl || !token) {
    console.log('eval:essay skipped: set HARNESS_URL and CHAT_API_TOKEN (a running harness, never prod) to run the golden essays.');
    return;
  }
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf(ONLY_FLAG);
  const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').filter(Boolean)) : null;
  const cases = readCases().filter((testCase) => !only || only.has(testCase.id));
  if (!cases.length) {
    console.log(`eval:essay skipped: no cases in ${path.relative(ROOT, GOLDEN_FILE)}`);
    return;
  }
  const provider = process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER;
  const model = process.env.EVAL_MODEL;
  const useJudge = args.includes(JUDGE_FLAG);
  /** Latency of each case (for evals/reports notebooks): wall clock + server `timings`. */
  const results: Array<EssayGoldenScore & { wallMs?: number; timings?: unknown }> = [];
  for (const testCase of cases) {
    const started = Date.now();
    try {
      const answer = await ask(baseUrl, token, {
        provider,
        ...(model ? { model } : {}),
        mode: ESSAY_MODE,
        question: testCase.question,
        includeTrace: true,
      });
      const score = scoreEssayCase(testCase, answer);
      if (useJudge) score.judge = await judge(baseUrl, token, testCase, answer);
      results.push({ ...score, wallMs: Date.now() - started, timings: (answer as EssayGoldenAnswer & { timings?: unknown }).timings });
      console.log(`${testCase.id}: ${pct(score.score)}${score.pass ? '' : ' (fail)'}`);
    } catch (error) {
      console.error(`${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ ...scoreEssayCase(testCase, { text: '' }), pass: false });
    }
  }

  console.table(results.map((result) => ({
    id: result.id,
    score: pct(result.score),
    pass: result.pass,
    words: `${result.wordCount}/${result.targetWords}`,
    lengthOk: result.lengthOk,
    citations: result.citationsValid,
    coverage: pct(result.coverage),
    missing: result.missingTerms.join(', '),
    ...(result.judge ? { judge: ESSAY_JUDGE_CRITERIA.map((criterion) => result.judge![criterion] ?? '-').join('/') } : {}),
  })));
  const summary = {
    kind: ESSAY_MODE,
    date: new Date().toISOString().slice(0, 10),
    provider,
    ...(model ? { model } : {}),
    meanScore: mean(results.map((result) => result.score)),
    passRate: mean(results.map((result) => (result.pass ? 1 : 0))),
    results,
  };
  console.log(`mean ${pct(summary.meanScore)} · pass ${pct(summary.passRate)}`);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `${summary.date}-essay.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`saved ${path.relative(ROOT, outFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
