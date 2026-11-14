import { NotFoundError, errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import type { CaptureImageSink, CaptureStoredImage } from '../../capture';
import {
  PairOutcome,
  SendStatus,
  StarlinguideErrorCode,
  classifyResult,
  fillsRequest,
  imageId,
  isLibraryFull,
  isTooLargeForPartner,
  maskEmail,
  partnerFileName,
  planBatches,
  type PartnerFile,
  type PartnerImageRef,
  type PartnerResult,
} from '../domain';
import {
  STARLINGUIDE_DEFAULT_RETRY_AFTER_SECONDS,
  STARLINGUIDE_LIBRARY_FULL_WARN_INTERVAL_MS,
  STARLINGUIDE_LOG_PREFIX,
  STARLINGUIDE_MAX_BATCH_WAIT_MS,
  STARLINGUIDE_MAX_PENDING_FILES,
  STARLINGUIDE_MAX_TIMEOUT_RETRIES,
  STARLINGUIDE_PAIR_RETRY_DELAYS_MS,
  STARLINGUIDE_REQUEST_RETRY_DELAYS_MS,
} from './constants/starlinguideForwarder.constants';
import type {
  EnqueueOutcome,
  ForwardJob,
  PartnerImageSource,
  StarlinguideCounters,
  StarlinguideForwarderOptions,
  StarlinguidePartnerClient,
  StarlinguideSendResult,
  StarlinguideStatusView,
} from './interfaces/starlinguideForwarder.interface';

const LOG = STARLINGUIDE_LOG_PREFIX;
const MS_PER_SECOND = 1000;

/** A file loaded for one request, with the ref it came from. */
interface LoadedFile {
  ref: PartnerImageRef;
  file: PartnerFile;
}

/**
 * Sends new capture photos to Starlinguide (planning-15112026-starlinguide-push).
 *
 * - Fed only by uploads (CaptureImageSink): photos already in the bucket are never sent.
 * - Waits `flushDelayMs` of quiet (at most 30 s) or a full request (20 files / 28 MB), then sends
 *   one request for every configured email. One request at a time; bytes are read from storage
 *   right before sending, so the queue holds metadata only.
 * - Retries follow the partner docs: only failed `INTERNAL_SERVER_ERROR` pairs are resent (alone);
 *   429 waits Retry-After; 5xx / network resend the whole request (the partner saved nothing);
 *   a timeout is resent once; 401 stops everything until the env is fixed and the service restarts.
 * - Never throws into the upload path. The queue lives in RAM: a restart loses what was waiting.
 */
export class StarlinguideForwarder implements CaptureImageSink {
  private pending: PartnerImageRef[] = [];
  private firstPendingAt = 0;
  private lastPendingAt = 0;
  private jobs: ForwardJob[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending = false;
  private draining = false;
  private blocked: string | null = null;
  private lastSentAt: number | null = null;
  private lastError: { at: number; message: string } | null = null;
  private readonly libraryFullWarnedAt = new Map<string, number>();
  private readonly counters: StarlinguideCounters = { requests: 0, pairsOk: 0, pairsFailed: 0, filesDropped: 0, failuresByCode: {} };
  private readonly now: () => number;
  private readonly maxBatchWaitMs: number;
  private readonly maxPendingFiles: number;

  constructor(
    private readonly client: StarlinguidePartnerClient,
    private readonly images: PartnerImageSource,
    private readonly options: StarlinguideForwarderOptions,
  ) {
    this.now = options.now ?? Date.now;
    this.maxBatchWaitMs = options.maxBatchWaitMs ?? STARLINGUIDE_MAX_BATCH_WAIT_MS;
    this.maxPendingFiles = options.maxPendingFiles ?? STARLINGUIDE_MAX_PENDING_FILES;
  }

  // ── CaptureImageSink ──

  imageStored(image: CaptureStoredImage): void {
    this.add([image]);
  }

  /** A photo deleted before it was sent is not sent. (Already sent: the partner API cannot delete.) */
  imageDeleted(folder: string, index: number, name: string): void {
    const id = imageId({ folder, index, name });
    const before = this.pending.length;
    this.pending = this.pending.filter((ref) => imageId(ref) !== id);
    for (const job of this.jobs) job.refs = job.refs.filter((ref) => imageId(ref) !== id);
    this.jobs = this.jobs.filter((job) => job.refs.length > 0);
    if (this.pending.length !== before) this.schedule();
  }

  // ── Operations ──

  /** Manual re-push of photos (admin endpoint). May create duplicates on the partner side. */
  enqueue(refs: readonly PartnerImageRef[]): EnqueueOutcome {
    return this.add(refs);
  }

  status(): StarlinguideStatusView {
    const now = this.now();
    return {
      enabled: true,
      host: this.options.host,
      emails: this.options.emails.map(maskEmail),
      flushDelayMs: this.options.flushDelayMs,
      blocked: this.blocked,
      pendingFiles: this.pending.length + this.jobs.reduce((sum, job) => sum + job.refs.length, 0),
      scheduledJobs: this.jobs.length,
      sending: this.sending,
      lastSentAt: this.lastSentAt === null ? null : new Date(this.lastSentAt).toISOString(),
      lastError: this.lastError ? { at: new Date(this.lastError.at).toISOString(), message: this.lastError.message } : null,
      counters: { ...this.counters, failuresByCode: { ...this.counters.failuresByCode } },
      libraryFull: [...this.libraryFullWarnedAt.entries()]
        .filter(([, at]) => now - at < STARLINGUIDE_LIBRARY_FULL_WARN_INTERVAL_MS)
        .map(([email]) => maskEmail(email)),
    };
  }

  /** SIGTERM: send what is waiting right away (no new retries), within `graceMs`. */
  async shutdown(graceMs: number): Promise<void> {
    this.draining = true;
    this.clearTimer();
    const waiting = this.pending.length + this.jobs.reduce((sum, job) => sum + job.refs.length, 0);
    if (waiting === 0 || this.blocked) return;
    logger.info(`${LOG} shutdown: sending ${waiting} waiting photo(s)`);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.run(),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, graceMs); }),
    ]);
    if (timeout) clearTimeout(timeout);
    const left = this.pending.length + this.jobs.reduce((sum, job) => sum + job.refs.length, 0);
    if (left > 0) logger.warn(`${LOG} shutdown: ${left} photo(s) not sent (re-push them with POST /api/captures/batches/{folder}/{index}/starlinguide)`);
  }

  // ── Queue ──

  private add(refs: readonly PartnerImageRef[]): EnqueueOutcome {
    let queued = 0;
    let skipped = 0;
    for (const ref of refs) {
      const reason = this.rejectReason(ref);
      if (reason) {
        skipped += 1;
        this.counters.filesDropped += 1;
        logger.warn(`${LOG} not sent ${imageId(ref)}: ${reason}`);
        continue;
      }
      const now = this.now();
      if (this.pending.length === 0) this.firstPendingAt = now;
      this.lastPendingAt = now;
      this.pending.push({ folder: ref.folder, index: ref.index, seq: ref.seq, name: ref.name, mimeType: ref.mimeType, bytes: ref.bytes });
      queued += 1;
    }
    if (queued > 0) this.schedule();
    return { queued, skipped };
  }

  private rejectReason(ref: PartnerImageRef): string | null {
    if (this.blocked) return `sending stopped (${this.blocked})`;
    if (isTooLargeForPartner(ref.bytes)) return `${StarlinguideErrorCode.CONTEXT_FILE_TOO_LARGE} (> 20 MB)`;
    const id = imageId(ref);
    if (this.pending.some((p) => imageId(p) === id)) return 'already waiting';
    const waiting = this.pending.length + this.jobs.reduce((sum, job) => sum + job.refs.length, 0);
    if (waiting >= this.maxPendingFiles) return `queue full (${this.maxPendingFiles} photos waiting)`;
    return null;
  }

  /** When the pending photos are due: now when they fill a request, else after quiet time (capped). */
  private pendingDueAt(): number | null {
    if (this.pending.length === 0) return null;
    if (this.draining || fillsRequest(this.pending)) return this.now();
    return Math.min(this.lastPendingAt + this.options.flushDelayMs, this.firstPendingAt + this.maxBatchWaitMs);
  }

  private schedule(): void {
    if (this.sending || this.draining) return;
    this.clearTimer();
    const candidates = [this.pendingDueAt(), ...this.jobs.map((job) => job.dueAt)].filter((at): at is number => at !== null);
    if (candidates.length === 0) return;
    const delay = Math.max(0, Math.min(...candidates) - this.now());
    this.timer = setTimeout(() => { this.timer = null; void this.run(); }, delay);
    this.timer.unref?.();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Sends every due request, one after the other. */
  private async run(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      for (let job = this.takeDueJob(); job; job = this.takeDueJob()) {
        if (this.blocked) break;
        await this.execute(job);
      }
    } catch (err) {
      this.recordError(`unexpected: ${errorMessage(err)}`);
    } finally {
      this.sending = false;
      this.schedule();
    }
  }

  private takeDueJob(): ForwardJob | null {
    const now = this.now();
    // Draining (shutdown): everything is due now; the grace timeout bounds the loop.
    const dueIndex = this.jobs.findIndex((job) => this.draining || job.dueAt <= now);
    if (dueIndex >= 0) return this.jobs.splice(dueIndex, 1)[0];
    const pendingAt = this.pendingDueAt();
    if (pendingAt === null || pendingAt > now) return null;
    const [batch] = planBatches(this.pending);
    this.pending = this.pending.slice(batch.length);
    if (this.pending.length > 0) this.firstPendingAt = now;
    return { emails: [...this.options.emails], refs: batch, requestAttempts: 0, pairAttempts: 0, dueAt: now };
  }

  // ── One request ──

  private async execute(job: ForwardJob): Promise<void> {
    const loaded = await this.load(job.refs);
    if (loaded.length === 0) return;
    job.refs = loaded.map((l) => l.ref);
    let result: StarlinguideSendResult;
    try {
      result = await this.client.send(job.emails, loaded.map((l) => l.file));
    } catch (err) {
      result = { status: SendStatus.NETWORK, detail: errorMessage(err) };
    }
    this.counters.requests += 1;
    const pairs = job.emails.length * loaded.length;
    switch (result.status) {
      case SendStatus.OK:
        this.handleResults(job, loaded, result.results ?? []);
        break;
      case SendStatus.RATE_LIMITED: {
        const waitS = result.retryAfterSeconds ?? STARLINGUIDE_DEFAULT_RETRY_AFTER_SECONDS;
        logger.warn(`${LOG} 429 rate limited: retry in ${waitS} s`);
        this.jobs.push({ ...job, dueAt: this.now() + waitS * MS_PER_SECOND });
        break;
      }
      case SendStatus.UNAUTHORIZED:
        this.block('401 Unauthorized: STARLINGUIDE_PARTNER_SECRET rejected — fix the env and restart', pairs);
        break;
      case SendStatus.TOO_LARGE:
        if (job.refs.length > 1) {
          const half = Math.ceil(job.refs.length / 2);
          logger.warn(`${LOG} 413 body too large: splitting ${job.refs.length} files`);
          this.jobs.push({ ...job, refs: job.refs.slice(0, half), dueAt: this.now() }, { ...job, refs: job.refs.slice(half), dueAt: this.now() });
        } else {
          this.fail(SendStatus.TOO_LARGE, pairs, `413 for a single file ${imageId(job.refs[0])}`);
        }
        break;
      case SendStatus.BAD_REQUEST:
        this.fail(SendStatus.BAD_REQUEST, pairs, `400 bad request: ${result.detail ?? ''}`);
        break;
      case SendStatus.TIMEOUT:
        this.retryRequest(job, STARLINGUIDE_MAX_TIMEOUT_RETRIES, result, pairs);
        break;
      case SendStatus.SERVER:
      case SendStatus.NETWORK:
        this.retryRequest(job, STARLINGUIDE_REQUEST_RETRY_DELAYS_MS.length, result, pairs);
        break;
    }
  }

  /** Reads the bytes; a photo deleted meanwhile is skipped. */
  private async load(refs: readonly PartnerImageRef[]): Promise<LoadedFile[]> {
    const loaded: LoadedFile[] = [];
    for (const ref of refs) {
      try {
        const { body } = await this.images.readImage(ref.folder, ref.index, ref.name);
        loaded.push({ ref, file: { fileName: partnerFileName(ref), mimeType: ref.mimeType, body } });
      } catch (err) {
        this.counters.filesDropped += 1;
        if (err instanceof NotFoundError) logger.info(`${LOG} skipped ${imageId(ref)}: deleted before sending`);
        else this.recordError(`could not read ${imageId(ref)}: ${errorMessage(err)}`);
      }
    }
    return loaded;
  }

  private retryRequest(job: ForwardJob, maxRetries: number, result: StarlinguideSendResult, pairs: number): void {
    const cause = `${result.status}${result.detail ? ` (${result.detail})` : ''}`;
    if (job.requestAttempts >= maxRetries) {
      this.fail(result.status, pairs, `gave up after ${job.requestAttempts + 1} attempt(s): ${cause}`);
      return;
    }
    const delay = STARLINGUIDE_REQUEST_RETRY_DELAYS_MS[Math.min(job.requestAttempts, STARLINGUIDE_REQUEST_RETRY_DELAYS_MS.length - 1)];
    logger.warn(`${LOG} request failed: ${cause}; retry ${job.requestAttempts + 1}/${maxRetries} in ${delay / MS_PER_SECOND} s`);
    this.jobs.push({ ...job, requestAttempts: job.requestAttempts + 1, dueAt: this.now() + delay });
  }

  /** `results[]` runs email by email, file by file; matched by position, then by (email, name). */
  private handleResults(job: ForwardJob, loaded: readonly LoadedFile[], results: readonly PartnerResult[]): void {
    let ok = 0;
    let failed = 0;
    const retryByEmail = new Map<string, PartnerImageRef[]>();
    job.emails.forEach((email, e) => {
      loaded.forEach(({ ref, file }, f) => {
        const positional = results[e * loaded.length + f];
        const result = positional && positional.email === email && positional.name === file.fileName
          ? positional
          : results.find((r) => r.email === email && r.name === file.fileName);
        const code = result ? result.error?.code : StarlinguideErrorCode.MISSING_RESULT;
        const outcome = result?.file && !result.error ? PairOutcome.SUCCESS : classifyResult(code ?? StarlinguideErrorCode.MISSING_RESULT);
        if (outcome === PairOutcome.SUCCESS) {
          ok += 1;
          return;
        }
        const errorCode = code ?? StarlinguideErrorCode.MISSING_RESULT;
        if (outcome === PairOutcome.RETRY && job.pairAttempts < STARLINGUIDE_PAIR_RETRY_DELAYS_MS.length) {
          retryByEmail.set(email, [...(retryByEmail.get(email) ?? []), ref]);
          return;
        }
        failed += 1;
        this.countFailure(errorCode, 1);
        this.warnPairFailure(email, file.fileName, errorCode, result?.error?.message);
      });
    });
    for (const [email, refs] of retryByEmail) {
      const delay = STARLINGUIDE_PAIR_RETRY_DELAYS_MS[job.pairAttempts];
      this.jobs.push({ emails: [email], refs, requestAttempts: 0, pairAttempts: job.pairAttempts + 1, dueAt: this.now() + delay });
    }
    const retrying = [...retryByEmail.values()].reduce((sum, refs) => sum + refs.length, 0);
    this.counters.pairsOk += ok;
    this.counters.pairsFailed += failed;
    if (ok > 0) this.lastSentAt = this.now();
    logger.info(`${LOG} sent ${loaded.length} file(s) × ${job.emails.length} email(s): ${ok} ok, ${failed} failed, ${retrying} to retry`);
  }

  private warnPairFailure(email: string, fileName: string, code: string, message: string | undefined): void {
    const masked = maskEmail(email);
    if (isLibraryFull(code)) {
      const last = this.libraryFullWarnedAt.get(email);
      if (last !== undefined && this.now() - last < STARLINGUIDE_LIBRARY_FULL_WARN_INTERVAL_MS) return;
      this.libraryFullWarnedAt.set(email, this.now());
      this.recordError(`${code} for ${masked}: library full — the user must delete files in the Starlinguide app`);
      return;
    }
    this.recordError(`${code} for ${masked} / ${fileName}${message ? `: ${message}` : ''}`);
  }

  private fail(code: string, pairs: number, message: string): void {
    this.countFailure(code, pairs);
    this.counters.pairsFailed += pairs;
    this.recordError(message);
  }

  private block(reason: string, pairs: number): void {
    this.blocked = reason;
    const dropped = this.pending.length + this.jobs.reduce((sum, job) => sum + job.refs.length, 0);
    this.pending = [];
    this.jobs = [];
    this.counters.filesDropped += dropped;
    this.fail(SendStatus.UNAUTHORIZED, pairs, reason);
    logger.error(`${LOG} sending stopped: ${reason}`);
  }

  private countFailure(code: string, count: number): void {
    this.counters.failuresByCode[code] = (this.counters.failuresByCode[code] ?? 0) + count;
  }

  private recordError(message: string): void {
    this.lastError = { at: this.now(), message };
    logger.warn(`${LOG} ${message}`);
  }
}
