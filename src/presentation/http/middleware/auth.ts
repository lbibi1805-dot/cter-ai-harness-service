import * as http from 'http';

/**
 * Auth + email-masking middleware — moved verbatim from `src/api/server.ts`
 * (Phase 1, mục 4.A / mục 6 Phase 1 step 1). Behavior unchanged: still fail-open
 * when `ADMIN_TOKEN` is not set (Track B's separate API-key auth will be fail-closed
 * per mục 5.1 — NOT changed here, that's a Track B concern, out of scope).
 */
export function checkAuth(req: http.IncomingMessage): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${token}`;
}

export function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return maskEmailName(email);
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  return `${maskEmailName(localPart)}@${domain}`;
}

function maskEmailName(value: string): string {
  if (value.length <= 1) return '*';
  if (value.length <= 4) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}
