// Design-compliance eval of /c4 (12/11 plan 04 §7.2): does a /c4 run give a connected design (C1–C9 errors = 0),
// an instance count on every internal container (T7) and a design discussion with all seven topics (T1–T7)?
// Scored by code only (no judge). Usage: npm run eval:c4 [-- --only D01,D03]
// Needs a RUNNING harness: HARNESS_URL + CHAT_API_TOKEN (dev only, never prod). Each case = one `fast` /c4 run
// (architect + repair + discussion calls); keep it to these 3–4 cases on dev. The conversations it creates are
// soft-deleted afterwards (ADMIN_TOKEN set → hard-deleted).
// Env: EVAL_PROVIDER (default gemini), EVAL_C4_MODEL (default = the provider default).
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { readPromptConfig } from '../src/bootstrap/config/readers/promptConfig.reader';
import { ConnectivityCode, discussionTopicsPresent, DISCUSSION_SECTIONS, lintPlantUmlConnectivity } from '../src/modules/c4';
import { EvalKind, mean } from '../src/modules/prompts';

const ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(ROOT, 'evals', 'results');
const C4_PATH = '/api/c4';
const CONVERSATIONS_PATH = '/api/conversations/';
const DEFAULT_PROVIDER = 'gemini';
const ONLY_FLAG = '--only';
const PERCENT = 100;
/** Plan 04 §11: 100% of runs without connectivity errors. */
const TARGET = 1;

interface DesignCase {
  id: string;
  description: string;
  levels: string[];
}

/** Small on purpose (dev must stay light): one microservice, one SaaS, one internal system. */
const CASES: readonly DesignCase[] = [
  { id: 'D01', description: 'Hệ thống đặt vé xem phim theo microservice: Booking, Payment (cổng thanh toán ngoài), Notification (email). 50k người dùng giờ cao điểm.', levels: ['context', 'container'] },
  { id: 'D02', description: 'Nền tảng SaaS quản lý học tập cho nhiều trường đại học; mỗi trường đăng ký riêng, dữ liệu tách biệt. Chạy trên cloud.', levels: ['container'] },
  { id: 'D03', description: 'Hệ thống quản lý nghỉ phép nội bộ cho một công ty 300 nhân viên, đăng nhập bằng SSO của công ty, chạy on-prem.', levels: ['container'] },
];

interface LevelDto {
  level: string;
  ok: boolean;
  puml: string | null;
  connectivity?: { errors: Array<{ code: string; message: string; elementIds: string[] }>; warnings: Array<{ code: string; message: string; elementIds: string[] }> };
}

interface C4Dto {
  levels: LevelDto[];
  conversationId: string | null;
  discussion?: { markdown: string } | null;
  error?: string;
}

interface CaseScore {
  id: string;
  /** Rendered levels without connectivity errors (server report + PlantUML lint). */
  connected: number;
  /** The container level has no MISSING_INSTANCES warning. */
  instances: number;
  /** Discussion topics written / 7. */
  discussion: number;
  score: number;
  pass: boolean;
  problems: string[];
}

function score(testCase: DesignCase, dto: C4Dto): CaseScore {
  const problems: string[] = [];
  const drawn = dto.levels.filter((l) => l.ok);
  if (drawn.length === 0) problems.push('no level rendered');
  const clean = drawn.filter((l) => {
    const server = l.connectivity?.errors ?? [];
    const lint = l.puml ? lintPlantUmlConnectivity(l.puml).errors : [];
    for (const issue of [...server, ...lint]) problems.push(`${l.level}: ${issue.code} ${issue.elementIds.join(',')}`);
    return server.length === 0 && lint.length === 0;
  });
  const connected = drawn.length ? clean.length / drawn.length : 0;
  const container = drawn.find((l) => l.level === 'container');
  const missingInstances = container?.connectivity?.warnings.some((w) => w.code === ConnectivityCode.MISSING_INSTANCES) ?? true;
  if (missingInstances) problems.push('container: instances missing');
  const topics = dto.discussion?.markdown ? discussionTopicsPresent(dto.discussion.markdown) : [];
  const discussion = topics.length / DISCUSSION_SECTIONS.length;
  if (discussion < 1) problems.push(`discussion: ${topics.length}/${DISCUSSION_SECTIONS.length} topics`);
  const instances = missingInstances ? 0 : 1;
  const total = (connected + instances + discussion) / 3;
  return { id: testCase.id, connected, instances, discussion, score: total, pass: connected === 1 && instances === 1 && discussion === 1, problems };
}

async function post(baseUrl: string, token: string, body: Record<string, unknown>): Promise<C4Dto> {
  const response = await fetch(new URL(C4_PATH, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json() as C4Dto;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${json.error ?? 'unknown error'}`);
  return json;
}

/** Dev must stay light: remove the conversation the run created (hard with ADMIN_TOKEN). */
async function cleanup(baseUrl: string, token: string, conversationId: string | null): Promise<void> {
  if (!conversationId) return;
  const admin = process.env.ADMIN_TOKEN;
  const url = new URL(`${CONVERSATIONS_PATH}${encodeURIComponent(conversationId)}${admin ? '?hard=true' : ''}`, baseUrl);
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${admin ?? token}` } }).catch(() => undefined);
}

const pct = (value: number) => `${(value * PERCENT).toFixed(0)}%`;

async function main(): Promise<void> {
  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  if (!baseUrl || !token) {
    console.log('eval:c4 skipped: set HARNESS_URL and CHAT_API_TOKEN (a running dev harness, never prod).');
    return;
  }
  const args = process.argv.slice(2);
  const onlyIndex = args.indexOf(ONLY_FLAG);
  const only = onlyIndex >= 0 ? new Set((args[onlyIndex + 1] ?? '').split(',').filter(Boolean)) : null;
  const provider = process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER;
  const model = process.env.EVAL_C4_MODEL;
  const { promptVersion = 'unknown' } = readPromptConfig();

  const rows: CaseScore[] = [];
  for (const testCase of CASES.filter((c) => !only || only.has(c.id))) {
    try {
      const dto = await post(baseUrl, token, { provider, ...(model ? { model } : {}), description: testCase.description, levels: testCase.levels, fast: true });
      const row = score(testCase, dto);
      rows.push(row);
      console.log(`${testCase.id}: ${pct(row.score)}${row.pass ? '' : ` (fail: ${row.problems.join('; ')})`}`);
      await cleanup(baseUrl, token, dto.conversationId);
    } catch (error) {
      console.error(`${testCase.id}: ${error instanceof Error ? error.message : String(error)}`);
      rows.push({ id: testCase.id, connected: 0, instances: 0, discussion: 0, score: 0, pass: false, problems: ['request failed'] });
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const summary = {
    kind: EvalKind.DESIGN_COMPLIANCE,
    promptVersion,
    date,
    provider,
    model: model ?? null,
    meanScore: mean(rows.map((r) => r.score)),
    passRate: mean(rows.map((r) => (r.pass ? 1 : 0))),
    connectivityRate: mean(rows.map((r) => r.connected)),
    results: rows,
  };
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const outFile = path.join(RESULTS_DIR, `${date}-design-${promptVersion}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`saved ${path.relative(ROOT, outFile)} · mean ${pct(summary.meanScore)} · pass ${pct(summary.passRate)} · connectivity ${pct(summary.connectivityRate)} (target ${pct(TARGET)})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
