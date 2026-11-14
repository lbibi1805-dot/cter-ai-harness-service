import {
  DEFAULT_STARLINGUIDE_FLUSH_DELAY_MS,
  DEFAULT_STARLINGUIDE_TIMEOUT_MS,
  parseEmails,
  type StarlinguideSettings,
} from '../../../modules/starlinguide';
import { readInt, readOptionalString } from '../../../shared/config/env';
import { ConfigurationError, errorMessage } from '../../../shared/errors';

const FLUSH_DELAY_RANGE = [1_000, 60_000] as const;
const TIMEOUT_RANGE = [10_000, 600_000] as const;
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

function inRange(name: string, value: number, [min, max]: readonly [number, number]): number {
  if (value < min || value > max) throw new ConfigurationError(`${name} must be between ${min} and ${max}, got ${value}`);
  return value;
}

/**
 * Starlinguide push (planning-15112026-starlinguide-push).
 * STARLINGUIDE_API_BASE_URL unset = off. Set but missing the secret or the emails = startup error,
 * so a half-configured service never looks enabled while sending nothing.
 */
export function readStarlinguideConfig(): StarlinguideSettings | undefined {
  const rawBaseUrl = readOptionalString('STARLINGUIDE_API_BASE_URL');
  if (!rawBaseUrl) return undefined;
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new ConfigurationError('STARLINGUIDE_API_BASE_URL must be a URL, e.g. https://api.solve.vn/starlinguide-uat');
  }
  if (!HTTP_PROTOCOLS.has(url.protocol)) throw new ConfigurationError('STARLINGUIDE_API_BASE_URL must start with https://');

  const secret = readOptionalString('STARLINGUIDE_PARTNER_SECRET');
  if (!secret) throw new ConfigurationError('STARLINGUIDE_API_BASE_URL is set but STARLINGUIDE_PARTNER_SECRET is missing');
  const rawEmails = readOptionalString('STARLINGUIDE_EMAILS');
  if (!rawEmails) throw new ConfigurationError('STARLINGUIDE_API_BASE_URL is set but STARLINGUIDE_EMAILS is missing');
  let emails: string[];
  try {
    emails = parseEmails(rawEmails);
  } catch (err) {
    throw new ConfigurationError(`STARLINGUIDE_EMAILS: ${errorMessage(err)}`);
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ''),
    secret,
    emails,
    flushDelayMs: inRange('STARLINGUIDE_FLUSH_DELAY_MS', readInt('STARLINGUIDE_FLUSH_DELAY_MS', DEFAULT_STARLINGUIDE_FLUSH_DELAY_MS), FLUSH_DELAY_RANGE),
    timeoutMs: inRange('STARLINGUIDE_TIMEOUT_MS', readInt('STARLINGUIDE_TIMEOUT_MS', DEFAULT_STARLINGUIDE_TIMEOUT_MS), TIMEOUT_RANGE),
  };
}
