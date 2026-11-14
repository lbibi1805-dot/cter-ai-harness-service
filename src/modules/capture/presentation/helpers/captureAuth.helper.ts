import { timingSafeEqual } from 'crypto';
import type { IncomingMessage } from 'http';
import { HttpHeader } from '../../../../shared/http/enums/http.enums';
import type { QueryParams } from '../../../../shared/http/interfaces/router.interface';
import { CaptureKeySource } from '../enums/capture.enums';
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
