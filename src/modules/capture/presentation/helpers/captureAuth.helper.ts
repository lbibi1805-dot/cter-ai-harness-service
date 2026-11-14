import { createHmac, timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { HttpHeader } from '../../../../shared/http/enums/http.enums';
import type { QueryParams } from '../../../../shared/http/interfaces/router.interface';
import { CaptureDeleteTokenSource, CaptureKeySource } from '../enums/capture.enums';
import type { CaptureKeys } from '../interfaces/captureKeys.interface';

const BEARER = 'Bearer ';

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The key the caller sent: `X-Capture-Key` header, `?key=` query, or `Authorization: Bearer …`. */
export function presentedKey(req: IncomingMessage, query: QueryParams): string | null {
  const header = req.headers[CaptureKeySource.HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (query[CaptureKeySource.QUERY]?.trim()) return query[CaptureKeySource.QUERY].trim();
  const auth = req.headers[HttpHeader.AUTHORIZATION];
  if (typeof auth === 'string' && auth.startsWith(BEARER)) return auth.slice(BEARER.length).trim() || null;
  return null;
}

/** Read/delete access: CAPTURE_API_KEY or ADMIN_TOKEN. Fail-closed: with no key configured nobody gets in. */
export function hasCaptureAccess(keys: CaptureKeys, presented: string | null): boolean {
  if (!presented) return false;
  return [keys.apiKey, keys.adminToken].some((key) => !!key && sameSecret(key, presented));
}

/** Domain separation: a delete token is never usable as a read key. */
const DELETE_TOKEN_CONTEXT = 'capture-image-delete:';
/** 16 bytes of HMAC-SHA256, base64url (22 chars). */
const DELETE_TOKEN_BYTES = 16;

/**
 * Lets the uploader (no key) delete exactly one image: HMAC(CAPTURE_API_KEY, "folder/index/name").
 * Stateless, so a restart keeps it valid; rotating CAPTURE_API_KEY invalidates every token.
 */
export function imageDeleteToken(secret: string, imageId: string): string {
  return createHmac('sha256', secret).update(`${DELETE_TOKEN_CONTEXT}${imageId}`).digest().subarray(0, DELETE_TOKEN_BYTES).toString('base64url');
}

/** `X-Delete-Token` header or `?token=`. */
export function presentedDeleteToken(req: IncomingMessage, query: QueryParams): string | null {
  const header = req.headers[CaptureDeleteTokenSource.HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return query[CaptureDeleteTokenSource.QUERY]?.trim() || null;
}

export function hasImageDeleteToken(secret: string | undefined, imageId: string, presented: string | null): boolean {
  return !!secret && !!presented && sameSecret(imageDeleteToken(secret, imageId), presented);
}
