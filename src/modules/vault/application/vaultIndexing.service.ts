import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { ReindexOutcome, type VaultIndexer, type VaultIndexRunReport } from '../domain';
import { AUTO_INDEX_DEBOUNCE_MS, INDEX_RETRY_DELAYS_MS } from './constants/vaultIndexing.constants';

/**
 * Serializes vault indexing runs (and reconcile, which must not race an
 * indexing commit): one job at a time, uploads are debounced, a request that
 * arrives mid-run triggers exactly one follow-up run. Files that failed are
 * retried a few times with growing delays — while the DB is likely still awake.
 */
export class VaultIndexingService {
  private indexing = false;
  private activeRuns = 0;
  private rerunRequested = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  /** `createIndexer` is null when the vector index is not configured. */
  constructor(
    private readonly createIndexer: (() => VaultIndexer) | null,
    private readonly retryDelaysMs: readonly number[] = INDEX_RETRY_DELAYS_MS,
  ) {}

  isIndexing(): boolean {
    return this.indexing;
  }

  scheduleAfterUpload(): void {
    if (!this.createIndexer) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.indexing) {
        this.rerunRequested = true;
        return;
      }
      logger.info('Auto-index triggered by upload — background');
      this.retryAttempt = 0;
      void this.runInBackground('Auto-index failed');
    }, AUTO_INDEX_DEBOUNCE_MS);
  }

  requestManualReindex(): ReindexOutcome {
    if (!this.createIndexer) return ReindexOutcome.NOT_CONFIGURED;
    if (this.indexing) return ReindexOutcome.ALREADY_RUNNING;
    logger.info('Manual reindex triggered — background');
    this.retryAttempt = 0;
    void this.runInBackground('Manual reindex failed');
    return ReindexOutcome.STARTED;
  }

  /** Runs `job` when no indexing run (or other exclusive job) is active. */
  runExclusive<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job, job);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Runs one indexing pass and rethrows its error (used at startup). */
  async runNow(): Promise<VaultIndexRunReport> {
    const createIndexer = this.createIndexer;
    if (!createIndexer) return { indexed: 0, failed: 0 };
    // Counted from the request on (not from when the queue lets it run), so a second request sees "already running".
    this.activeRuns++;
    this.indexing = true;
    return this.runExclusive(async () => {
      const run = await attempt(() => createIndexer().indexAll());
      this.activeRuns--;
      this.indexing = this.activeRuns > 0;
      const failed = run.ok ? run.value?.failed ?? 0 : 0;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.scheduleAfterUpload();
      } else if (failed > 0) {
        this.scheduleRetry(failed);
      } else if (run.ok) {
        this.retryAttempt = 0;
      }
      if (!run.ok) throw run.error;
      return run.value ?? { indexed: 0, failed: 0 };
    });
  }

  /** Stops timers (tests, shutdown). */
  dispose(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.debounceTimer = null;
    this.retryTimer = null;
  }

  private scheduleRetry(failed: number): void {
    if (this.retryAttempt >= this.retryDelaysMs.length || this.retryTimer) {
      if (this.retryAttempt >= this.retryDelaysMs.length) logger.warn(`[vault] ${failed} files still failing after ${this.retryAttempt} retries — use POST /api/vault/reindex`);
      return;
    }
    const delay = this.retryDelaysMs[this.retryAttempt++];
    logger.info(`[vault] ${failed} files failed to index — retry ${this.retryAttempt}/${this.retryDelaysMs.length} in ${delay}ms`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.runInBackground('Index retry failed');
    }, delay);
  }

  private async runInBackground(failureLabel: string): Promise<void> {
    const run = await attempt(() => this.runNow());
    if (!run.ok) logger.error(`${failureLabel}: ${errorMessage(run.error)}`);
  }
}
