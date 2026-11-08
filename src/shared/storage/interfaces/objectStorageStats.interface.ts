export interface PrefixUsage {
  objects: number;
  bytes: number;
}

export interface ObjectStorageStats {
  kind: string;
  /** Bucket name (R2) or directory (local disk). */
  location: string;
  prefixes: Record<string, PrefixUsage>;
  totalObjects: number;
  totalBytes: number;
  latencyMs: number;
}
