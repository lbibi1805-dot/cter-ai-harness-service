/** Chunks + embeds every pending vault entry. */
export interface VaultIndexer {
  indexAll(): Promise<void>;
}

export type VaultIndexerFactory = () => VaultIndexer;

/** Re-indexes soon after files change (debounced); a no-op when no vector index is configured. */
export interface VaultIndexScheduler {
  scheduleAfterUpload(): void;
}
