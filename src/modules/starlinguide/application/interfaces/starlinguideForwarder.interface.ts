import type { PartnerFile, PartnerImageRef, PartnerResult, SendStatus } from '../../domain';

/** What one `POST /partner/context-files` came back with. Never thrown: every failure is a status. */
export interface StarlinguideSendResult {
  status: SendStatus;
  /** Present when `status` is `ok`. */
  results?: PartnerResult[];
  /** 429: seconds to wait (Retry-After header or `retry_after_seconds`). */
  retryAfterSeconds?: number;
  /** Short cause for logs (`HTTP 502`, `ECONNRESET`…), never the secret. */
  detail?: string;
}

/** Port to the Partner API (infrastructure: StarlinguideHttpClient). */
export interface StarlinguidePartnerClient {
  send(emails: readonly string[], files: readonly PartnerFile[]): Promise<StarlinguideSendResult>;
}

/** Where photo bytes come from right before sending (the capture service, i.e. object storage). */
export interface PartnerImageSource {
  readImage(folder: string, index: number, name: string): Promise<{ body: Buffer }>;
}

export interface StarlinguideForwarderOptions {
  emails: readonly string[];
  flushDelayMs: number;
  /** Shown in status / logs (no path, no secret). */
  host: string;
  maxBatchWaitMs?: number;
  maxPendingFiles?: number;
  now?: () => number;
}

/** A request waiting to be sent (fresh photos for every email, or a retry). */
export interface ForwardJob {
  emails: string[];
  refs: PartnerImageRef[];
  requestAttempts: number;
  pairAttempts: number;
  dueAt: number;
}

export interface StarlinguideCounters {
  requests: number;
  pairsOk: number;
  pairsFailed: number;
  /** Photos never sent: queue full, too large, blocked, deleted before sending, shutdown. */
  filesDropped: number;
  /** Failed pairs per `error.code` (or request-level status). */
  failuresByCode: Record<string, number>;
}

/** `GET /api/captures/starlinguide/status`. Emails are masked. */
export interface StarlinguideStatusView {
  enabled: true;
  host: string;
  emails: string[];
  flushDelayMs: number;
  /** Set when sending stopped by itself (secret rejected): fix the env and restart. */
  blocked: string | null;
  pendingFiles: number;
  scheduledJobs: number;
  sending: boolean;
  lastSentAt: string | null;
  lastError: { at: string; message: string } | null;
  counters: StarlinguideCounters;
  /** Emails whose library is full (100 files / 500 MB): the user must delete files in the app. */
  libraryFull: string[];
}

export interface EnqueueOutcome {
  queued: number;
  skipped: number;
}
