// Shared helpers for the load tests: a bounded worker pool, latency stats,
// heap/timer probes, a fake Pinecone rerank API and a metrics sink.
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as path from 'path';
import * as v8 from 'v8';
import * as vm from 'vm';

export interface TaskOutcome<T> {
  ok: boolean;
  ms: number;
  value?: T;
  error?: string;
}

/** Runs `total` tasks with at most `concurrency` in flight. */
export async function runPool<T>(total: number, concurrency: number, task: (i: number) => Promise<T>): Promise<{ outcomes: TaskOutcome<T>[]; wallMs: number }> {
  const outcomes: TaskOutcome<T>[] = new Array(total);
  let next = 0;
  const started = performance.now();
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const t0 = performance.now();
      try {
        outcomes[i] = { ok: true, ms: performance.now() - t0, value: await task(i) };
        outcomes[i].ms = performance.now() - t0;
      } catch (err) {
        outcomes[i] = { ok: false, ms: performance.now() - t0, error: (err as Error).message };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return { outcomes, wallMs: performance.now() - started };
}

export interface LatencySummary {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

export function latency(values: number[]): LatencySummary {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))] ?? 0;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    count: sorted.length,
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.at(-1) ?? 0),
    mean: round(sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length)),
  };
}

v8.setFlagsFromString('--expose_gc');
const gc = vm.runInNewContext('gc') as () => void;

/** Heap after a full GC, in MB — comparable across rounds. */
export function heapUsedMb(): number {
  gc();
  gc();
  return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10;
}

/** Live `setTimeout` handles (a leak shows up here first). */
export function activeTimers(): number {
  return process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FakeRerankBehaviour {
  /** Base latency plus uniform jitter (ms). */
  latencyMs: number;
  jitterMs: number;
  /** Share of requests answered with HTTP 500. */
  errorRate: number;
  /** Share of requests delayed by `slowMs` (to trip the client timeout). */
  slowRate: number;
  slowMs: number;
}

/**
 * Pinecone Inference `POST /rerank` stand-in. Scores a document by how many
 * query words it contains (deterministic, so ordering is checkable).
 */
export class FakeRerankServer {
  behaviour: FakeRerankBehaviour = { latencyMs: 0, jitterMs: 0, errorRate: 0, slowRate: 0, slowMs: 0 };
  requests = 0;
  errors = 0;
  slow = 0;
  maxDocuments = 0;
  baseUrl = '';
  private rng = mulberry32(42);
  private server = http.createServer((req, res) => void this.handle(req, res));

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parts: Buffer[] = [];
    for await (const part of req) parts.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(parts).toString() || '{}') as { query: string; documents: Array<{ text: string }>; top_n?: number };
    this.requests++;
    this.maxDocuments = Math.max(this.maxDocuments, body.documents.length);
    const { latencyMs, jitterMs, errorRate, slowRate, slowMs } = this.behaviour;
    const roll = this.rng();
    await sleep(latencyMs + this.rng() * jitterMs + (roll >= errorRate && roll < errorRate + slowRate ? (this.slow++, slowMs) : 0));
    if (roll < errorRate) {
      this.errors++;
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'injected failure' } }));
      return;
    }
    const words = new Set(body.query.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
    const data = body.documents
      .map((d, index) => ({ index, score: Math.min(1, [...words].filter((w) => d.text.toLowerCase().includes(w)).length / Math.max(1, words.size)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, body.top_n ?? body.documents.length);
    if (res.destroyed) return;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ model: 'bge-reranker-v2-m3', data, usage: { rerank_units: 1 } }));
  }
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const RUNS_DIR = path.resolve(__dirname, 'runs');

/** Appends one scenario's metrics to load/runs/latest.json (gitignored) and prints them. */
export function recordMetrics(scenario: string, metrics: Record<string, unknown>): void {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const file = path.join(RUNS_DIR, 'latest.json');
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown> : {};
  all[scenario] = { ...metrics, recordedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(all, null, 2));
  console.log(`\n[load] ${scenario}\n${JSON.stringify(metrics, null, 2)}`);
}
