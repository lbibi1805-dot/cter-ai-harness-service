import type { IncomingMessage } from 'http';
import { HttpHeader } from './enums/http.enums';

/** One token, or several accepted tokens (e.g. the chat client's token and ADMIN_TOKEN for the monitoring UI). */
export type AuthTokens = string | undefined | ReadonlyArray<string | undefined>;

/**
 * Bearer check against the accepted token(s). Still fail-open when no token is
 * configured, matching the existing deployment contract.
 */
export function isAuthorized(req: IncomingMessage, tokens: AuthTokens): boolean {
  const accepted = (Array.isArray(tokens) ? tokens : [tokens]).filter((token): token is string => !!token);
  if (accepted.length === 0) return true;
  const header = req.headers[HttpHeader.AUTHORIZATION] ?? '';
  return accepted.some((token) => header === `Bearer ${token}`);
}
