import type { IncomingMessage } from 'http';
import { HttpHeader } from './http.enums';

/**
 * Bearer check against `ADMIN_TOKEN`. Still fail-open when no token is
 * configured, matching the existing deployment contract.
 */
export function isAuthorized(req: IncomingMessage, adminToken: string | undefined): boolean {
  if (!adminToken) return true;
  return (req.headers[HttpHeader.AUTHORIZATION] ?? '') === `Bearer ${adminToken}`;
}
