import { MAX_TRACKED_SQL_TAGS, UNKNOWN_SQL_TAG } from './constants/dbMetrics.constants';
import type { DbQueryStats } from './interfaces/dbMetrics.interface';

/**
 * Counts database round-trips in RAM (Neon bills awake time: this is how the
 * team checks that the database can sleep). Process-wide by default because
 * every repository shares one Neon client per URL.
 */
export class DbQueryCounter {
  private readonly bootAt: number;
  private queries = 0;
  private transactions = 0;
  private failed = 0;
  private lastAt: number | null = null;
  private lastTag: string | null = null;
  private readonly byTag = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {
    this.bootAt = now();
  }

  record(tag: string, options: { transaction?: boolean } = {}): void {
    this.queries++;
    if (options.transaction) this.transactions++;
    this.lastAt = this.now();
    this.lastTag = tag;
    const key = this.byTag.has(tag) || this.byTag.size < MAX_TRACKED_SQL_TAGS ? tag : UNKNOWN_SQL_TAG;
    this.byTag.set(key, (this.byTag.get(key) ?? 0) + 1);
  }

  recordFailure(): void {
    this.failed++;
  }

  /** Total round-trips since boot (handy for budget tests). */
  count(): number {
    return this.queries;
  }

  snapshot(): DbQueryStats {
    return {
      bootAt: new Date(this.bootAt).toISOString(),
      queriesSinceBoot: this.queries,
      transactionsSinceBoot: this.transactions,
      failedQueries: this.failed,
      lastQueryAt: this.lastAt === null ? null : new Date(this.lastAt).toISOString(),
      lastQueryTag: this.lastTag,
      byTag: Object.fromEntries(this.byTag),
    };
  }
}

/** The process-wide counter every Neon-backed `SqlClient` reports to. */
export const dbQueryCounter = new DbQueryCounter();
