import * as http from 'http';
import { validateAllKeys, type KeyValidationResult } from '../../../ai/aiRouter';
import { maskEmail } from '../middleware/auth';
import type { HttpRouterContext } from '../context';

/**
 * System/ops routes — moved verbatim from `src/api/server.ts` (Phase 1, mục 3 / mục 6
 * Phase 1 step 1): `/api/canvas-accounts`, `/api/cron`, `GET /`, `/health`, `/start`,
 * `/stop` (polling control). Split into two entry points to preserve the exact
 * original route-matching order in `server.ts`'s `handle()`:
 *  - `handleSystemAdminRouter` runs BEFORE the `/api/vault` prefix check and the
 *    general "GET only" guard (matches original: canvas-accounts/cron accept
 *    non-GET methods).
 *  - `handleSystemInfoRouter` runs AFTER the general "GET only" guard (matches
 *    original: `/`, `/health`, `/start`, `/stop` are GET-only).
 */
export async function handleSystemAdminRouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  ctx: HttpRouterContext,
): Promise<boolean> {
  if (pathname === '/api/canvas-accounts') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ accounts: ctx.config.accounts.map(a => ({ index: a.index, url: a.url, email: a.email ? maskEmail(a.email) : null })) }));
    return true;
  }
  if (pathname === '/api/cron') {
    const { isCronEnabled, getCronIntervalMs, setCronEnabled, setCronInterval } = await import('../../../utils/cronManager');
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ enabled: isCronEnabled(), intervalMs: getCronIntervalMs() }));
      return true;
    }
    if (req.method === 'POST') {
      const { checkAuth } = await import('../middleware/auth');
      if (!checkAuth(req)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
      let body = '';
      req.on('data', (c: Buffer) => body += c.toString());
      await new Promise<void>(resolve => req.on('end', () => resolve()));
      try {
        const j = JSON.parse(body || '{}');
        if (typeof j.enabled === 'boolean') setCronEnabled(j.enabled, ctx.port);
        if (typeof j.intervalMs === 'number') setCronInterval(j.intervalMs, ctx.port);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ enabled: isCronEnabled(), intervalMs: getCronIntervalMs() }));
      } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (e as Error).message })); }
      return true;
    }
  }
  return false;
}

export async function handleSystemInfoRouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  ctx: HttpRouterContext,
): Promise<boolean> {
  if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'up',
      polling: ctx.isRunning() ? 'running' : 'stopped',
      canvasAccounts: ctx.config.accounts.map(a => ({ index: a.index, email: a.email ? maskEmail(a.email) : null })),
      aiKeys: { claude: !!ctx.config.aiKeys.claude, gemini: !!ctx.config.aiKeys.gemini, grok: !!ctx.config.aiKeys.grok, openai: !!ctx.config.aiKeys.openai },
      vault: ctx.config.vaultConfig ? { index: ctx.config.vaultConfig.pineconeIndex, provider: ctx.config.vaultConfig.embeddingProvider } : null,
    }));
    return true;
  }

  if (pathname === '/health') {
    let vaultStatus = 'no-vault-config';
    if (ctx.config.vaultConfig) {
      try {
        const { createVaultStorageWithFallback } = await import('../../../modules/vault');
        const storage = await createVaultStorageWithFallback();
        const { total, indexed } = await storage.stats();
        vaultStatus = `${indexed}/${total} indexed`;
      } catch (e) { vaultStatus = `error: ${(e as Error).message}`; }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'up', aiKeys: { claude: !!ctx.config.aiKeys.claude, gemini: !!ctx.config.aiKeys.gemini, grok: !!ctx.config.aiKeys.grok, openai: !!ctx.config.aiKeys.openai }, vault: vaultStatus, polling: ctx.isRunning() ? 'running' : 'stopped' }));
    return true;
  }

  if (pathname === '/start') {
    if (ctx.isRunning()) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'already_running' })); return true; }
    try {
      const results: KeyValidationResult[] = await validateAllKeys(ctx.config.aiKeys, ctx.config.grokBaseUrl);
      ctx.startPolling();
      ctx.notifyUsersWhenStartOrStop('started');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'started', validation: results }));
    } catch (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (err as Error).message })); }
    return true;
  }

  if (pathname === '/stop') {
    if (!ctx.isRunning()) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'already_stopped' })); return true; }
    ctx.stopPolling();
    ctx.notifyUsersWhenStartOrStop('paused');
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'stopped' }));
    return true;
  }

  return false;
}
