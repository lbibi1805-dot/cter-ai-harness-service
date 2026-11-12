// Rule-compliance eval (12/11 02 Bước 7): does the answer follow prompts/ over reference material, honour explicit
// user overrides and ignore fake ones? Cases: evals/golden/rule-compliance.jsonl (rule-based scoring, no judge).
// Usage: npm run eval:rules [-- --only R01,R06]
// Needs a RUNNING harness: HARNESS_URL + CHAT_API_TOKEN (dev only, never prod). Matrix from env:
//   EVAL_RULE_MODES  (default "single-shot,agent")  — /c4 is not covered here (it answers JSON specs, see /api/c4)
//   EVAL_RULE_MODELS (default "<EVAL_PROVIDER>:" = the provider default), e.g. "gemini:gemini-3.1-flash-lite,gemini:gemini-3.5-flash,openai:"
// Each case costs one /api/chat call per (mode, model): 8 cases × 2 modes = 16 calls. Keep the matrix small on dev.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { readPromptConfig } from '../src/bootstrap/config/readers/promptConfig.reader';
import { EvalKind, mean, scoreGoldenCase, type GoldenAnswer, type GoldenCase, type GoldenScore } from '../src/modules/prompts';

const ROOT = path.resolve(__dirname, '..');
const CASES_FILE = path.join(ROOT, 'evals', 'golden', 'rule-compliance.jsonl');
const RESULTS_DIR = path.join(ROOT, 'evals', 'results');
const CHAT_PATH = '/api/chat';
const DEFAULT_PROVIDER = 'gemini';
const DEFAULT_MODES = 'single-shot,agent';
const ONLY_FLAG = '--only';
const PERCENT = 100;
/** Target of 12/11 02 Bước 7 with the default model. */
const TARGET = 0.9;

interface RuleCase extends GoldenCase {
  group: string;
}

interface Variant {
  mode: string;
  provider: string;
  model?: string;
}

function readCases(): RuleCase[] {
  return fs.readFileSync(CASES_FILE, 'utf-8').split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line) as RuleCase);
}

function variants(): Variant[] {
  const modes = (process.env.EVAL_RULE_MODES ?? DEFAULT_MODES).split(',').map((m) => m.trim()).filter(Boolean);
  const models = (process.env.EVAL_RULE_MODELS ?? `${process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER}:`).split(',').map((m) => m.trim()).filter(Boolean);
  return modes.flatMap((mode) => models.map((entry) => {
    const [provider, model] = entry.split(':');
    return { mode, provider, ...(model ? { model } : {}) };
  }));
}

async function ask(baseUrl: string, token: string, body: Record<string, unknown>): Promise<GoldenAnswer & { model?: string; mode?: string }> {
  const response = await fetch(new URL(CHAT_PATH, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json() as GoldenAnswer & { error?: string };
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${json.error ?? 'unknown error'}`);
  return json;
}

const pct = (value: number) => `${(value * PERCENT).toFixed(0)}%`;

async function main(): Promise<void> {
  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  if (!baseUrl || !token) {
    console.log('eval:rules skipped: set HARNESS_URL and CHAT_API_TOKEN (a running dev harness, never prod).');
    return;
  }
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf(ONLY_FLAG);
  const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').filter(Boolean)) : null;
  const cases = readCases().filter((c) => !only || only.has(c.id));
  const { promptVersion = 'unknown' } = readPromptConfig();

  const rows: Array<GoldenScore & Variant & { group: string; answeredMode?: string }> = [];
  for (const variant of variants()) {
    for (const testCase of cases) {
      try {
        const answer = await ask(baseUrl, token, { provider: variant.provider, ...(variant.model ? { model: variant.model } : {}), mode: variant.mode, question: testCase.question });
        const score = scoreGoldenCase(testCase, answer);
        rows.push({ ...score, ...variant, group: testCase.group, answeredMode: answer.mode });
        console.log(`${variant.mode} ${variant.provider}:${variant.model ?? '-'} ${testCase.id}: ${pct(score.score)}${score.pass ? '' : ` (fail: ${[...score.missingPoints, ...score.forbiddenHits.map((f) => `forbidden ${f}`)].join(', ')})`}`);
      } catch (error) {
        console.error(`${variant.mode} ${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
        rows.push({ ...scoreGoldenCase(testCase, { text: '' }), ...variant, group: testCase.group, pass: false });
      }
    }
  }

  const byVariant = variants().map((v) => {
    const own = rows.filter((r) => r.mode === v.mode && r.provider === v.provider && r.model === v.model);
    return { ...v, meanScore: mean(own.map((r) => r.score)), passRate: mean(own.map((r) => (r.pass ? 1 : 0))) };
  });
  console.table(byVariant.map((v) => ({ mode: v.mode, model: `${v.provider}:${v.model ?? 'default'}`, score: pct(v.meanScore), pass: pct(v.passRate), target: v.passRate >= TARGET ? 'OK' : 'below 90%' })));

  const date = new Date().toISOString().slice(0, 10);
  const summary = {
    kind: EvalKind.RULE_COMPLIANCE,
    promptVersion,
    date,
    provider: process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER,
    meanScore: mean(rows.map((r) => r.score)),
    passRate: mean(rows.map((r) => (r.pass ? 1 : 0))),
    variants: byVariant,
    results: rows,
  };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `${date}-rules-${promptVersion}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`saved ${path.relative(ROOT, outFile)} · mean ${pct(summary.meanScore)} · pass ${pct(summary.passRate)} (target ${pct(TARGET)})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
