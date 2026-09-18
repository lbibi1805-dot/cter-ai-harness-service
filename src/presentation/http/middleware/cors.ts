import * as http from 'http';

/**
 * CORS middleware — moved verbatim from `src/api/server.ts` (Phase 1, mục 4.A /
 * mục 6 Phase 1 step 1). Behavior unchanged, only relocated.
 */
export function setCors(res: http.ServerResponse, req: http.IncomingMessage): void {
  const rawAllowed = (process.env.FRONTEND_URL ?? process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  // normalize: remove trailing slash for comparison (origin never has trailing slash)
  const allowed = rawAllowed.map(s => s.replace(/\/$/, ''));
  const origin = (req.headers.origin ?? '').replace(/\/$/, '');
  const isAllowed = (o: string) => {
    if (!o) return false;
    if (allowed.includes(o)) return true;
    if (allowed.includes('*')) return true;
    // allow all *.vercel.app previews when any vercel.app is in allowlist (handshake for preview deploys)
    if (o.endsWith('.vercel.app') && allowed.some(a => a.endsWith('.vercel.app'))) return true;
    return false;
  };
  if (allowed.length === 0) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (isAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // for handshake debugging, still allow preview vercel deploys
    if (origin.endsWith('.vercel.app')) res.setHeader('Access-Control-Allow-Origin', origin);
    else res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');
}
