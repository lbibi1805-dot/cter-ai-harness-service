/** Top-level key prefixes inside one bucket. One bucket per environment; purposes are split by prefix. */
export enum ObjectPrefix {
  /** `vault/{docId}/{contentHash}.{ext}` — vault source files, content-addressed, never overwritten. */
  VAULT = 'vault/',
  /** `vault-images/{sha256}.{ext}` — images referenced by vault files (shared, content-addressed). */
  VAULT_IMAGES = 'vault-images/',
  /** `derived/{docId}/{contentHash}/…` — extracted text, captions (PDF ingestion). */
  DERIVED = 'derived/',
  /** `conversations/{conversationId}/{artifactId}.{ext}` — user images, C4 PNG/PUML. */
  CONVERSATIONS = 'conversations/',
  /** Scratch space; the bucket lifecycle rule deletes it after 1 day. */
  TMP = 'tmp/',
}

export enum ObjectStorageKind {
  R2 = 'r2',
  LOCAL_DISK = 'local-disk',
}

/** Custom metadata keys (S3 lower-cases them). */
export enum ObjectMetadataKey {
  SHA256 = 'sha256',
}
