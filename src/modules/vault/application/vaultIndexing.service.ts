import { logger } from '../../../utils/logger';
import { ReindexOutcome, type VaultIndexerFactory } from '../domain';

export const AUTO_INDEX_DEBOUNCE_MS = 2000;

/**
 * Serializes vault indexing runs: only one at a time, uploads are debounced,
 * and a request that arrives mid-run triggers exactly one follow-up run.
 */
export class VaultIndexingService {
  private indexing = false;
  private rerunRequested = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  /** `createIndexer` is null when the vector index is not configured. */
  constructor(private readonly createIndexer: VaultIndexerFactory | null) {}

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
      void this.runInBackground('Auto-index failed');
    }, AUTO_INDEX_DEBOUNCE_MS);
  }

  requestManualReindex(): ReindexOutcome {
    if (!this.createIndexer) return ReindexOutcome.NOT_CONFIGURED;
    if (this.indexing) return ReindexOutcome.ALREADY_RUNNING;
    logger.info('Manual reindex triggered — background');
    void this.runInBackground('Manual reindex failed');
    return ReindexOutcome.STARTED;
  }

  /** Runs one indexing pass and rethrows its error (used at startup). */
  async runNow(): Promise<void> {
    if (!this.createIndexer) return;
    this.indexing = true;
    try {
      await this.createIndexer().indexAll();
    } finally {
      this.indexing = false;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.scheduleAfterUpload();
      }
    }
  }

  private async runInBackground(failureLabel: string): Promise<void> {
    try {
      await this.runNow();
    } catch (err) {
      logger.info(`${failureLabel}: ${(err as Error).message}`);
    }
  }
}
