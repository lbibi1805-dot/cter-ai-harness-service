import { ValidationError } from '../../../shared/errors';
import {
  EMAIL_PATTERN,
  EMAIL_SEPARATORS,
  PARTNER_INDEX_DIGITS,
  PARTNER_SEQ_DIGITS,
  STARLINGUIDE_MAX_EMAILS,
  STARLINGUIDE_MAX_FILE_BYTES,
  STARLINGUIDE_MAX_FILES_PER_REQUEST,
  STARLINGUIDE_MAX_REQUEST_BYTES,
} from './constants/starlinguide.constants';
import { PairOutcome, StarlinguideErrorCode } from './enums/starlinguide.enums';
import type { PartnerImageRef } from './interfaces/starlinguide.interface';

/** `alice@example.com` → `a***@example.com` (logs and status never show full addresses). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * `STARLINGUIDE_EMAILS` → list. Comma / semicolon / newline separated, trimmed, exact duplicates dropped.
 * Case is kept: the partner treats `Alice@x.com` and `alice@x.com` as two accounts.
 */
export function parseEmails(raw: string): string[] {
  const emails = [...new Set(raw.split(EMAIL_SEPARATORS).map((e) => e.trim()).filter(Boolean))];
  if (emails.length === 0) throw new ValidationError('at least one email is required');
  if (emails.length > STARLINGUIDE_MAX_EMAILS) throw new ValidationError(`at most ${STARLINGUIDE_MAX_EMAILS} emails, got ${emails.length}`);
  const invalid = emails.filter((e) => !EMAIL_PATTERN.test(e));
  if (invalid.length > 0) throw new ValidationError(`not an email: ${invalid.map(maskEmail).join(', ')}`);
  return emails;
}

/** Stable id of a capture photo: `folder/index/name`. */
export function imageId(ref: Pick<PartnerImageRef, 'folder' | 'index' | 'name'>): string {
  return `${ref.folder}/${ref.index}/${ref.name}`;
}

/** Name shown in the Starlinguide library: `bach-0007-03.jpg` (folder, exercise number, photo order). */
export function partnerFileName(ref: Pick<PartnerImageRef, 'folder' | 'index' | 'seq' | 'name'>): string {
  const dot = ref.name.lastIndexOf('.');
  const extension = dot >= 0 ? ref.name.slice(dot + 1) : 'jpg';
  const index = String(ref.index).padStart(PARTNER_INDEX_DIGITS, '0');
  const seq = String(ref.seq).padStart(PARTNER_SEQ_DIGITS, '0');
  return `${ref.folder}-${index}-${seq}.${extension}`;
}

/** True when the partner would reject the file for its size alone (never sent). */
export function isTooLargeForPartner(bytes: number): boolean {
  return bytes > STARLINGUIDE_MAX_FILE_BYTES;
}

export interface BatchLimits {
  maxFiles: number;
  maxBytes: number;
}

export const PARTNER_BATCH_LIMITS: BatchLimits = {
  maxFiles: STARLINGUIDE_MAX_FILES_PER_REQUEST,
  maxBytes: STARLINGUIDE_MAX_REQUEST_BYTES,
};

/** True when the photos already fill one request (send now instead of waiting for the debounce). */
export function fillsRequest(items: readonly { bytes: number }[], limits: BatchLimits = PARTNER_BATCH_LIMITS): boolean {
  return items.length >= limits.maxFiles || items.reduce((sum, i) => sum + i.bytes, 0) >= limits.maxBytes;
}

/**
 * Splits photos (in order) into requests of at most `maxFiles` files and `maxBytes` bytes.
 * A single photo over `maxBytes` still gets a request of its own (photos over the per-file limit are dropped earlier).
 */
export function planBatches<T extends { bytes: number }>(items: readonly T[], limits: BatchLimits = PARTNER_BATCH_LIMITS): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let currentBytes = 0;
  for (const item of items) {
    if (current.length > 0 && (current.length >= limits.maxFiles || currentBytes + item.bytes > limits.maxBytes)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += item.bytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Only `INTERNAL_SERVER_ERROR` (or a pair missing from the answer) is worth retrying, for that pair only. */
export function classifyResult(code: string | undefined): PairOutcome {
  if (code === undefined) return PairOutcome.SUCCESS;
  if (code === StarlinguideErrorCode.INTERNAL_SERVER_ERROR || code === StarlinguideErrorCode.MISSING_RESULT) return PairOutcome.RETRY;
  return PairOutcome.PERMANENT;
}

/** The user's library is full: only the user can fix it (delete files in the Starlinguide app). */
export function isLibraryFull(code: string): boolean {
  return code === StarlinguideErrorCode.CONTEXT_FILE_LIMIT || code === StarlinguideErrorCode.STORAGE_QUOTA_EXCEEDED;
}
