import * as http from 'http';
import { logger } from '../../../utils/logger';
import { checkAuth } from '../middleware/auth';
import type { HttpRouterContext, QueryParams } from '../context';

/**
 * `/api/logs` + `/api/ai-usage` — moved verbatim from `src/api/server.ts` (Phase 1,
 * mục 3 / mục 6 Phase 1 step 1). Returns `true` if the request was handled.
 */
export async function handleLogsRouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  query: QueryParams,
  ctx: HttpRouterContext,
): Promise<boolean> {
  if (pathname === '/api/logs') {
    if (req.method === 'DELETE') {
      if (!checkAuth(req)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return true; }
      logger.clear();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return true;
    }
    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 500);
    const logs = logger.getLogs(limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs }));
    return true;
  }
  if (pathname === '/api/ai-usage') {
    const usage = {
      providers: ctx.config.modelFallback,
      defaults: ctx.config.defaultModels,
      // naive counters from logger buffer (count AI tag)
      aiCalls: logger.getLogs(500).filter(l => l.tag === 'AI').length,
      lastLogs: logger.getLogs(20).filter(l => l.tag === 'AI' || l.tag === 'RETRY' || l.tag === 'FAILED').slice(-10),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(usage));
    return true;
  }
  return false;
}
