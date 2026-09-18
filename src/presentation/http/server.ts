import * as http from 'http';
import type { AppConfig } from '../../types';
import { EmailNotifier } from '../../utils/emailNotifier';
import { logger } from '../../utils/logger';
import { setCors } from './middleware/cors';
import { handleDocsRouter } from './routers/docs';
import { handleLogsRouter } from './routers/logs';
import { handleSystemAdminRouter, handleSystemInfoRouter } from './routers/system';
import { handleVaultRouter } from './routers/vault';
import type { HttpRouterContext, QueryParams } from './context';

type PollFn = () => Promise<void>;

/**
 * Composition root for the HTTP surface — moved from `src/api/server.ts` (Phase 1,
 * mục 3 / mục 4.A / mục 6 Phase 1 step 1). Only mounts routers now; all route logic
 * was relocated verbatim into `presentation/http/{middleware,routers}/*`.
 *
 * Route dispatch order in `handle()` is preserved exactly from the original
 * monolithic `server.ts` to keep behavior identical:
 * docs -> logs -> system(admin: canvas-accounts/cron) -> vault -> [GET-only guard] ->
 * system(info: /,/health,/start,/stop) -> 404.
 */
export class ApiServer {
  private server: http.Server;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private isPolling = false;

  constructor(
    private pollFn: PollFn,
    private config: AppConfig,
    private emailNotifier: EmailNotifier,
    private port: number,
  ) {
    this.server = http.createServer((req, res) => { void this.handle(req, res); });
  }

  start(): void {
    this.server.listen(this.port, () => {
      logger.info(`API server listening on port ${this.port}`);
    });
  }

  private runPoll(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollFn()
      .catch(console.error)
      .finally(() => { this.isPolling = false; });
  }

  private startPolling(): void {
    this.running = true;
    this.runPoll();
    this.timer = setInterval(() => {
      if (!this.running) return;
      this.runPoll();
    }, this.config.pollIntervalMs);
    logger.info('Polling started');
  }

  private stopPolling(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.running = false;
    logger.info('Polling stopped — in-flight jobs will finish');
  }

  private notifyUsersWhenStartOrStop(_action: 'started' | 'paused'): void { return; }

  private get ctx(): HttpRouterContext {
    return {
      config: this.config,
      port: this.port,
      isRunning: () => this.running,
      startPolling: () => this.startPolling(),
      stopPolling: () => this.stopPolling(),
      notifyUsersWhenStartOrStop: (action) => this.notifyUsersWhenStartOrStop(action),
    };
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    setCors(res, req);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = u.pathname;
    const query = Object.fromEntries(u.searchParams.entries()) as QueryParams;
    const ctx = this.ctx;

    if (await handleDocsRouter(req, res, pathname)) return;
    if (await handleLogsRouter(req, res, pathname, query, ctx)) return;
    if (await handleSystemAdminRouter(req, res, pathname, ctx)) return;

    // Vault API: need POST/DELETE support, so check vault prefix before GET-only guard
    if (pathname.startsWith('/api/vault')) {
      await handleVaultRouter(req, res, pathname, query, ctx);
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (await handleSystemInfoRouter(req, res, pathname, ctx)) return;

    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' }));
  }
}
