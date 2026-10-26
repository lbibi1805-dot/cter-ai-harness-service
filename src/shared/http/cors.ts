import type { IncomingMessage, ServerResponse } from 'http';
import { withoutTrailingSlash, isVercelPreview } from './helpers/cors.helper';
import { ALLOWED_HEADERS, ALLOW_ANY_ORIGIN, ALLOWED_METHODS } from './constants/cors.constants';

/**
 * The origin echoed in Access-Control-Allow-Origin. With no allow-list every
 * origin is allowed; Vercel preview origins are allowed whenever any
 * vercel.app origin is listed (or no listed origin matches) so preview
 * deployments of the monitoring UI keep working.
 */
export function resolveAllowedOrigin(requestOrigin: string, allowList: readonly string[]): string {
  const origin = withoutTrailingSlash(requestOrigin);
  const allowed = allowList.map(withoutTrailingSlash);
  if (allowed.length === 0) return origin || ALLOW_ANY_ORIGIN;
  if (!origin) return allowed[0];
  if (allowed.includes(origin) || allowed.includes(ALLOW_ANY_ORIGIN)) return origin;
  if (isVercelPreview(origin)) return origin;
  return allowed[0];
}

export function applyCors(req: IncomingMessage, res: ServerResponse, allowList: readonly string[]): void {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers.origin ?? '', allowList));
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Vary', 'Origin');
}
