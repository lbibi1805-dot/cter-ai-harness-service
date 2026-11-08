import { LATENCY_RECORDER_CAPACITY, DEFAULT_LATENCY_WINDOW_MS } from '../domain/constants/latency.constants';
import { percentiles } from '../domain/helpers/percentile.helper';
import type { LatencyEntry, LatencyGroupSummary, LatencySummary } from '../domain/interfaces/latencyRecorder.interface';

/**
 * In-memory ring buffer of the last `capacity` invocations (no database: 07 §3.1 metrics are for ops checks, not
 * history). `summary()` aggregates a time window per provider/model.
 */
export class LatencyRecorder {
  private readonly buffer: LatencyEntry[] = [];
  private next = 0;

  constructor(
    private readonly capacity: number = LATENCY_RECORDER_CAPACITY,
    private readonly now: () => number = Date.now,
  ) {}

  record(entry: LatencyEntry): void {
    if (this.buffer.length < this.capacity) this.buffer.push(entry);
    else this.buffer[this.next] = entry;
    this.next = (this.next + 1) % this.capacity;
  }

  /** Entries finished within the last `windowMs`, oldest first. */
  entries(windowMs: number = DEFAULT_LATENCY_WINDOW_MS): LatencyEntry[] {
    const since = this.now() - windowMs;
    const ordered = this.buffer.length < this.capacity ? this.buffer : [...this.buffer.slice(this.next), ...this.buffer.slice(0, this.next)];
    return ordered.filter((entry) => entry.at >= since);
  }

  summary(windowMs: number = DEFAULT_LATENCY_WINDOW_MS): LatencySummary {
    const entries = this.entries(windowMs);
    const groups = new Map<string, LatencyEntry[]>();
    for (const entry of entries) {
      const key = `${entry.provider}\u0000${entry.model}`;
      const group = groups.get(key);
      if (group) group.push(entry);
      else groups.set(key, [entry]);
    }
    const summaries = [...groups.values()].map(summarizeGroup).sort((a, b) => b.count - a.count);
    return { windowMs, count: entries.length, groups: summaries };
  }
}

function summarizeGroup(entries: LatencyEntry[]): LatencyGroupSummary {
  const errorsByKind: Record<string, number> = {};
  let retries = 0;
  let inputTokens = 0;
  let cachedTokens = 0;
  let outputTokens = 0;
  let withInput = false;
  for (const entry of entries) {
    retries += Math.max(0, entry.attempts - 1);
    if (entry.errorKind) errorsByKind[entry.errorKind] = (errorsByKind[entry.errorKind] ?? 0) + 1;
    if (entry.inputTokens !== undefined) {
      withInput = true;
      inputTokens += entry.inputTokens;
      cachedTokens += entry.cachedTokens ?? 0;
    }
    outputTokens += entry.outputTokens ?? 0;
  }
  const ttfts = entries.flatMap((entry) => (entry.ttftMs === undefined ? [] : [entry.ttftMs]));
  return {
    provider: entries[0].provider,
    model: entries[0].model,
    count: entries.length,
    retries,
    errors: Object.values(errorsByKind).reduce((sum, n) => sum + n, 0),
    errorsByKind,
    ttftMs: ttfts.length > 0 ? percentiles(ttfts) : null,
    totalMs: percentiles(entries.map((entry) => entry.totalMs)),
    inputTokens,
    cachedTokens,
    outputTokens,
    cacheHitRate: withInput && inputTokens > 0 ? cachedTokens / inputTokens : null,
  };
}
