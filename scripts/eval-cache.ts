// KV-cache eval (18 §7): one short scripted conversation (chat → /c4 → 3 follow-ups about the diagram) against a
// RUNNING harness, recording inputTokens / cachedTokens / TTFT per turn. The conversation is hard-deleted afterwards.
// Usage: npm run eval:cache -- --label v2-k2 [--scenario long]     (restart the harness with another PROMPT_CACHE_LAYOUT /
//        CONTEXT_HOT_WINDOW_TURNS between runs to compare layouts). Never point it at prod.
// Needs HARNESS_URL + CHAT_API_TOKEN + ADMIN_TOKEN (for the hard delete). Writes evals/reports/data/cache-<label>.json.
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'evals', 'reports', 'data');
const LABEL_FLAG = '--label';
const DEFAULT_PROVIDER = 'gemini';

interface TurnResult {
  turn: number;
  kind: 'chat' | 'c4';
  question: string;
  ok: boolean;
  error?: string;
  inputTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
  ttftMs?: number;
  totalMs?: number;
  wallMs: number;
}

/** `--scenario long`: 6 detailed answers (~2k+ tokens of history by turn 4) to see history caching, not only layer ①. */
const LONG_SCRIPT: Array<{ kind: 'chat' | 'c4'; text: string }> = [
  { kind: 'chat', text: 'Giải thích chi tiết (khoảng 400 từ) khái niệm process và thread trong QNX, kèm ví dụ.' },
  { kind: 'chat', text: 'Tiếp theo, giải thích chi tiết (khoảng 400 từ) các trạng thái của thread trong QNX và chuyển trạng thái.' },
  { kind: 'chat', text: 'Bây giờ giải thích chi tiết (khoảng 400 từ) Native QNX Message Passing: MsgSend, MsgReceive, MsgReply.' },
  { kind: 'chat', text: 'So sánh cơ chế đó với POSIX message queue (khoảng 300 từ).' },
  { kind: 'chat', text: 'Race condition là gì và mutex giải quyết nó thế nào trong QNX? (khoảng 300 từ)' },
  { kind: 'chat', text: 'Tóm tắt toàn bộ những gì ta đã trao đổi thành 5 gạch đầu dòng.' },
];

const SCENARIO_FLAG = '--scenario';

const SCRIPT: Array<{ kind: 'chat' | 'c4'; text: string }> = [
  { kind: 'chat', text: 'Mình đang làm bài thiết kế hệ thống đặt vé xem phim online: khách đặt vé, thanh toán qua VNPay, nhận vé qua email. Hệ thống cần những thành phần chính nào? Trả lời ngắn.' },
  { kind: 'c4', text: 'Hệ thống đặt vé xem phim online: khách hàng đặt vé, thanh toán qua cổng VNPay, nhận vé qua email. Vẽ context.' },
  { kind: 'chat', text: 'Trong hình bạn vẽ lúc nãy có những hệ thống ngoài nào?' },
  { kind: 'chat', text: 'Nếu thêm gửi SMS nhắc lịch chiếu thì hình đó thay đổi thế nào? 3 câu.' },
  { kind: 'chat', text: 'Tóm tắt lại các actor trong hình bằng một bảng.' },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function stream(url: string, token: string, body: Record<string, unknown>): Promise<Record<string, any>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...body, stream: true }),
  });
  const lines = (await response.text()).split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
  const error = lines.find((e) => e.type === 'error');
  if (!response.ok || error) throw new Error(`HTTP ${response.status}: ${error?.message ?? 'error'}`);
  return lines.find((e) => e.type === 'done') ?? {};
}

async function main(): Promise<void> {
  const baseUrl = process.env.HARNESS_URL;
  const token = process.env.CHAT_API_TOKEN;
  const admin = process.env.ADMIN_TOKEN;
  if (!baseUrl || !token || !admin) {
    console.log('eval:cache skipped: set HARNESS_URL, CHAT_API_TOKEN and ADMIN_TOKEN (a running harness, never prod).');
    return;
  }
  const label = arg(LABEL_FLAG) ?? 'run';
  const scenario = arg(SCENARIO_FLAG) === 'long' ? 'long' : 'c4';
  const script = scenario === 'long' ? LONG_SCRIPT : SCRIPT;
  const provider = process.env.EVAL_PROVIDER ?? DEFAULT_PROVIDER;
  const config = await (await fetch(new URL('/api/config', baseUrl), { headers: { Authorization: `Bearer ${admin}` } })).json().catch(() => ({})) as Record<string, unknown>;
  let conversationId: string | undefined;
  const turns: TurnResult[] = [];
  try {
    for (const [i, step] of script.entries()) {
      const started = Date.now();
      try {
        const done = step.kind === 'c4'
          ? await stream(new URL('/api/c4', baseUrl).toString(), token, { provider, conversationId, fast: true, levels: ['context'], description: step.text })
          : await stream(new URL('/api/chat', baseUrl).toString(), token, { provider, conversationId, question: step.text });
        conversationId ??= done.conversationId;
        const t = done.timings ?? {};
        turns.push({
          turn: i + 1, kind: step.kind, question: step.text, ok: true, wallMs: Date.now() - started,
          inputTokens: t.inputTokens, cachedTokens: t.cachedTokens, outputTokens: t.outputTokens, ttftMs: t.ttftMs, totalMs: t.totalMs,
        });
      } catch (err) {
        turns.push({ turn: i + 1, kind: step.kind, question: step.text, ok: false, error: (err as Error).message, wallMs: Date.now() - started });
      }
      console.log(`${label} turn ${i + 1} (${step.kind}): in ${turns.at(-1)?.inputTokens ?? '-'} cached ${turns.at(-1)?.cachedTokens ?? '-'} ttft ${turns.at(-1)?.ttftMs ?? '-'}`);
    }
  } finally {
    if (conversationId) {
      await fetch(new URL(`/api/conversations/${conversationId}?hard=true`, baseUrl), { method: 'DELETE', headers: { Authorization: `Bearer ${admin}` } });
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `cache-${label}.json`);
  fs.writeFileSync(file, `${JSON.stringify({
    label, scenario, date: new Date().toISOString(), provider,
    layout: config.PROMPT_CACHE_LAYOUT ?? null, hotWindowTurns: config.CONTEXT_HOT_WINDOW_TURNS ?? null, turns,
  }, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
