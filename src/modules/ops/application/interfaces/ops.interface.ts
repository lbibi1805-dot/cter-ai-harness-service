import type { ObjectStorageProbe, ObjectStorageStats } from '../../../../shared/storage';
import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import type { DeepCheckName, DeepCheckStatus } from '../../domain/enums/ops.enums';

/** One deep probe: resolves with optional details, throws on failure. Only run by `GET /health/deep`. */
export type DeepProbe = () => Promise<Record<string, unknown> | void>;

/** What the ops endpoints report about the rest of the service (wired in bootstrap). */
export interface OpsStatusSource {
  accounts: CanvasAccountConfig[];
  pollingState(): string;
  /** Per-provider credential presence under the active gateway. */
  aiCredentials(): Record<string, boolean>;
  /** Gateway, default models and fallback chains, for `/api/ai-usage`. */
  aiModels(): Record<string, unknown>;
  /** Null when the vector index is not configured. */
  vectorIndex: { index: string; provider: string } | null;
  /** RAM only (must not query the database). Null while the manifest is still loading. */
  vaultStats(): Promise<{ total: number; indexed: number } | null>;
  /** Put/head/delete one tiny object (on demand only — costs R2 operations). Absent: no object storage. */
  probeStorage?(): Promise<ObjectStorageProbe>;
  /** Probes for `GET /health/deep`; a missing entry is reported as skipped. */
  deepProbes?: Partial<Record<DeepCheckName, DeepProbe>>;
  /** RAM counters for `GET /api/metrics/db` (query count, last query, cursor flushes). */
  dbMetrics?(): Record<string, unknown>;
  /** Non-secret flags and limits for `GET /api/config`. */
  publicConfig?(): Record<string, unknown>;
  /** Object count and bytes per prefix (lists the bucket: on demand only). */
  storageStats?(): Promise<ObjectStorageStats>;
  /** Latency percentiles over the last `windowMs` (RAM ring buffer). */
  latency?: (windowMs: number) => unknown;
  /** Models currently skipped by the circuit breaker, for `/api/ai-usage`. */
  circuit?: () => unknown;
  /** Prompt registry files (`GET /api/prompts`, note 06): RAM. */
  prompts?: () => unknown;
  /** Golden-eval runs on local disk (`GET /api/evals`, notes 06/15). */
  evals?: (kind?: string) => unknown;
}

export interface MaskedAccount {
  index: number;
  email: string | null;
}

export interface DeepCheckResult {
  status: DeepCheckStatus;
  latencyMs?: number;
  error?: string;
  [detail: string]: unknown;
}

export interface DeepHealthReport {
  ok: boolean;
  checkedAt: string;
  checks: Record<DeepCheckName, DeepCheckResult>;
}
