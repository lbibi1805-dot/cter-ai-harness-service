import type { VaultDocumentReader } from './vaultDocumentStore.port';
import type { VaultRepository } from './vault.repository';

/** Chunks + embeds every pending vault entry. */
export interface VaultIndexer {
  /** Returns how many files failed (the scheduler retries them later). */
  indexAll(): Promise<VaultIndexRunReport>;
}

export interface VaultIndexRunReport {
  indexed: number;
  failed: number;
}

export type VaultIndexerFactory = (repository: VaultRepository, documents: VaultDocumentReader) => VaultIndexer;

/** Re-indexes soon after files change (debounced); a no-op when no vector index is configured. */
export interface VaultIndexScheduler {
  scheduleAfterUpload(): void;
}
