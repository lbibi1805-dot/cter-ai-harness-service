// Golden multi-question eval (12/11 plan 08 Bước 8): one turn must answer EVERY question, long enough, nothing cut.
// Rules: coverage (answered / asked, target 100 %), essay answers ≥ 80 % of their target words, truncated = 0,
// no incomplete sentences; optional LLM judge "câu văn đầy đủ" 0–10 (--judge).
// Usage: npm run eval:answers [-- --judge] [-- --only MQ01,MQ02] [-- --offline]
// --offline: checks the golden set against the rule-based splitter only (no harness, no model call).
// Live mode needs a RUNNING harness: HARNESS_URL (e.g. http://localhost:3000) + CHAT_API_TOKEN; never point it at
// prod. Long cases cost several model calls each (sections, continuations): run a few small cases on dev only.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_ANSWER_COMPLETENESS, buildAnswerPlan, scoreAnswerCase, type AnswerGoldenCase, type AnswerGoldenScore } from '../src/modules/chat';

const ROOT = path.resolve(__dirname, '..');
const GOLDEN_FILE = path.join(ROOT, 'evals', 'golden', 'multi-question.jsonl');
const RESULTS_DIR = path.join(ROOT, 'evals', 'results');
const CHAT_PATH = '/api/chat';
const DEFAULT_PROVIDER = 'gemini';
const JUDGE_FLAG = '--judge';
const ONLY_FLAG = '--only';
const OFFLINE_FLAG = '--offline';
const JUDGE_MAX = 10;
const NUMBER = /\d+(?:\.\d+)?/;
const PERCENT = 100;

interface ChatReply {
  text: string;
  completeness?: { truncated?: boolean; missing?: string[] };
  timings?: unknown;
  error?: string;
}

function readCases(): AnswerGoldenCase[] {
  if (!fs.existsSync(GOLDEN_FILE)) return [];
  return fs.readFileSync(GOLDEN_FILE, 'utf-8').split(/\r?\n/).filter((line) => line.trim()).map((line, i) => {
    try {
      return JSON.parse(line) as AnswerGoldenCase;
    } catch {
      throw new Error(`multi-question.jsonl:${i + 1} is not valid JSON`);
    }
  });
}

async function ask(baseUrl: string, token: string, body: Record<string, unknown>): Promise<ChatReply> {
  const response = await fetch(new URL(CHAT_PATH, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json() as ChatReply;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${json.error ?? 'unknown error'}`);
  return json;
}

async function judge(baseUrl: string, token: string, answer: string): Promise<number | undefined> {
  const reply = await ask(baseUrl, token, {
    provider: process.env.EVAL_JUDGE_PROVIDER ?? process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER,
    ...(process.env.EVAL_JUDGE_MODEL ? { model: process.env.EVAL_JUDGE_MODEL } : {}),
    question: `Score from 0 to ${JUDGE_MAX} how much the text below is written in complete, well-formed sentences (no fragments, no keyword-only bullets, nothing cut off). Reply with the number only.\n\n${answer}`,
  });
  const value = Number(NUMBER.exec(reply.text)?.[0]);
  return Number.isFinite(value) ? Math.min(JUDGE_MAX, Math.max(0, value)) : undefined;
}

const pct = (value: number) => `${(value * PERCENT).toFixed(0)}%`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf(ONLY_FLAG);
  const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').filter(Boolean)) : null;
  const cases = readCases().filter((testCase) => !only || only.has(testCase.id));
  if (!cases.length) {
    console.log(`eval:answers skipped: no cases in ${path.relative(ROOT, GOLDEN_FILE)}`);
    return;
  }

  if (args.includes(OFFLINE_FLAG)) {
    let ok = 0;
    for (const testCase of cases) {
      const plan = buildAnswerPlan(testCase.question, DEFAULT_ANSWER_COMPLETENESS);
      const match = plan.questions.length === testCase.expected_questions;
      if (match) ok++;
      console.log(`${testCase.id}: ${plan.questions.length}/${testCase.expected_questions} questions ${match ? 'ok' : 'MISMATCH'} · targets ${plan.questions.map((q) => q.targetWords ?? '-').join('/')} · ~${plan.estimatedTokens} tokens`);
    }
    console.log(`splitter: ${ok}/${cases.length} cases match`);
    if (ok !== cases.length) process.exitCode = 1;
    return;
  }

  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  if (!baseUrl || !token) {
    console.log('eval:answers skipped: set HARNESS_URL and CHAT_API_TOKEN (a running harness, never prod), or run with --offline.');
    return;
  }
  const provider = process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER;
  const model = process.env.EVAL_MODEL;
  const useJudge = args.includes(JUDGE_FLAG);
  const results: Array<AnswerGoldenScore & { wallMs?: number; timings?: unknown }> = [];
  for (const testCase of cases) {
    const started = Date.now();
    try {
      const reply = await ask(baseUrl, token, { provider, ...(model ? { model } : {}), question: testCase.question });
      const score = scoreAnswerCase(testCase, reply.text, reply.completeness?.truncated ?? false, DEFAULT_ANSWER_COMPLETENESS);
      if (useJudge) score.judge = await judge(baseUrl, token, reply.text);
      results.push({ ...score, wallMs: Date.now() - started, timings: reply.timings });
      console.log(`${testCase.id}: coverage ${pct(score.coverage)}, short ${score.shortAnswers.length}, incomplete ${score.incompleteSentences}${score.truncated ? ', TRUNCATED' : ''}${score.judge !== undefined ? `, judge ${score.judge}` : ''}${score.pass ? '' : ' (fail)'}`);
    } catch (error) {
      console.error(`${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      results.push({ ...scoreAnswerCase(testCase, '', false, DEFAULT_ANSWER_COMPLETENESS), pass: false });
    }
  }
  const passed = results.filter((r) => r.pass).length;
  const summary = {
    cases: results.length,
    passed,
    coverageAvg: results.reduce((sum, r) => sum + r.coverage, 0) / results.length,
    truncated: results.filter((r) => r.truncated).length,
    incompleteSentences: results.reduce((sum, r) => sum + r.incompleteSentences, 0),
  };
  console.log(`eval:answers: ${passed}/${results.length} pass · coverage ${pct(summary.coverageAvg)} · truncated ${summary.truncated}`);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${new Date().toISOString().slice(0, 10)}-answers.json`);
  fs.writeFileSync(file, JSON.stringify({ provider, model: model ?? null, summary, results }, null, 2));
  console.log(`saved ${path.relative(ROOT, file)}`);
}

void main();
