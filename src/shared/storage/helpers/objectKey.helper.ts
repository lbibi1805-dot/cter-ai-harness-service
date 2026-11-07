import * as crypto from 'crypto';
import { ValidationError } from '../../errors';
import { ObjectPrefix } from '../enums/objectStorage.enums';
import { MAX_OBJECT_KEY_LENGTH } from '../constants/objectStorage.constants';

const KNOWN_PREFIXES: readonly string[] = Object.values(ObjectPrefix);
const BACKSLASH = '\\';
const FORBIDDEN_SEGMENTS = new Set(['..', '.', '']);

export class InvalidObjectKeyError extends ValidationError {}

/** Rejects keys outside the app's prefixes, path tricks (`..`, `//`, `\`) and oversized keys. */
export function assertValidKey(key: string): void {
  if (!key || key.length > MAX_OBJECT_KEY_LENGTH) throw new InvalidObjectKeyError(`Invalid object key length: "${key.slice(0, 80)}"`);
  const segments = key.split('/');
  // A trailing "/" (prefix) leaves one empty last segment; anything else empty is "//" or a leading "/".
  const inner = key.endsWith('/') ? segments.slice(0, -1) : segments;
  if (key.includes(BACKSLASH) || inner.some((part) => FORBIDDEN_SEGMENTS.has(part))) {
    throw new InvalidObjectKeyError(`Invalid object key: "${key}"`);
  }
  if (!KNOWN_PREFIXES.some((prefix) => key.startsWith(prefix) && key.length > prefix.length)) {
    throw new InvalidObjectKeyError(`Object key outside known prefixes: "${key}"`);
  }
}

/** A prefix must end with "/" and be a known prefix or a sub-folder of one — never the bucket root. */
export function assertValidPrefix(prefix: string): void {
  if (!prefix.endsWith('/')) throw new InvalidObjectKeyError(`Prefix must end with "/": "${prefix}"`);
  if (KNOWN_PREFIXES.includes(prefix)) return;
  assertValidKey(prefix);
}

export function sha256Hex(body: Buffer | string): string {
  return crypto.createHash('sha256').update(body).digest('hex');
}

export function toBuffer(body: Buffer | string): Buffer {
  return typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;
}
