import * as http from 'http';
import type { AppConfig } from '../types';
import { validateAllKeys, type KeyValidationResult } from '../ai/aiRouter';
import { EmailNotifier } from '../utils/emailNotifier';
import { logger } from '../utils/logger';
import { isAuthorized } from '../shared/http/auth';
import { VAULT_API_PREFIX, type VaultModule } from '../modules/vault';

type PollFn = () => Promise<void>;

function maskEmail(email: string): string {
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

function setCors(res: http.ServerResponse, req: http.IncomingMessage): void {
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
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Confirm');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

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
    private vault: VaultModule,
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

  startPolling(): void {
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

  private notifyUsersWhenStartOrStop(action: 'started' | 'paused'): void { return; }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    setCors(res, req);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const u = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = u.pathname;
    const query = Object.fromEntries(u.searchParams.entries()) as Record<string, string>;

    // OpenAPI + Swagger
    if (pathname === '/openapi.json') {
      try {
        const fs = await import('fs'); const p = await import('path');
        const specPath = p.resolve(process.cwd(), 'docs/openapi.json');
        const spec = fs.readFileSync(specPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(spec); return;
      } catch { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'spec not found' })); return; }
    }
    if (pathname === '/docs' || pathname === '/docs/') {
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vault API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset]});</script></body></html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return;
    }

    if (pathname === '/api/logs') {
      if (req.method === 'DELETE') {
        if (!isAuthorized(req, this.config.adminToken)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        logger.clear();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 500);
      const logs = logger.getLogs(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ logs }));
      return;
    }
    if (pathname === '/api/ai-usage') {
      const usage = {
        providers: this.config.modelFallback,
        defaults: this.config.defaultModels,
        // naive counters from logger buffer (count AI tag)
        aiCalls: logger.getLogs(500).filter(l => l.tag === 'AI').length,
        lastLogs: logger.getLogs(20).filter(l => l.tag === 'AI' || l.tag === 'RETRY' || l.tag === 'FAILED').slice(-10),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(usage));
      return;
    }
    if (pathname === '/api/canvas-accounts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ accounts: this.config.accounts.map(a => ({ index: a.index, url: a.url, email: a.email ? maskEmail(a.email) : null })) }));
      return;
    }
    if (pathname === '/api/cron') {
      const { isCronEnabled, getCronIntervalMs, setCronEnabled, setCronInterval } = await import('../utils/cronManager');
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ enabled: isCronEnabled(), intervalMs: getCronIntervalMs() }));
        return;
      }
      if (req.method === 'POST') {
        if (!isAuthorized(req, this.config.adminToken)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
        let body = '';
        req.on('data', (c: Buffer) => body += c.toString());
        await new Promise<void>(res => req.on('end', () => res()));
        try {
          const j = JSON.parse(body || '{}');
          if (typeof j.enabled === 'boolean') setCronEnabled(j.enabled, this.port);
          if (typeof j.intervalMs === 'number') setCronInterval(j.intervalMs, this.port);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ enabled: isCronEnabled(), intervalMs: getCronIntervalMs() }));
        } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (e as Error).message })); }
        return;
      }
    }

    // Vault API: need POST/DELETE support, so check vault prefix before GET-only guard
    if (pathname.startsWith(VAULT_API_PREFIX)) {
      await this.vault.router.dispatch(req, res, u);
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'up',
        polling: this.running ? 'running' : 'stopped',
        canvasAccounts: this.config.accounts.map(a => ({ index: a.index, email: a.email ? maskEmail(a.email) : null })),
        aiKeys: { claude: !!this.config.aiKeys.claude, gemini: !!this.config.aiKeys.gemini, grok: !!this.config.aiKeys.grok, openai: !!this.config.aiKeys.openai },
        vault: this.config.vaultConfig ? { index: this.config.vaultConfig.pineconeIndex, provider: this.config.vaultConfig.embeddingProvider } : null,
      }));
      return;
    }

    if (pathname === '/health') {
      let vaultStatus = 'no-vault-config';
      if (this.config.vaultConfig) {
        try {
          const { total, indexed } = await this.vault.service.stats();
          vaultStatus = `${indexed}/${total} indexed`;
        } catch (e) { vaultStatus = `error: ${(e as Error).message}`; }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'up', aiKeys: { claude: !!this.config.aiKeys.claude, gemini: !!this.config.aiKeys.gemini, grok: !!this.config.aiKeys.grok, openai: !!this.config.aiKeys.openai }, vault: vaultStatus, polling: this.running ? 'running' : 'stopped' }));
      return;
    }

    if (pathname === '/start') {
      if (this.running) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'already_running' })); return; }
      try {
        const results: KeyValidationResult[] = await validateAllKeys(this.config.aiKeys, this.config.grokBaseUrl);
        this.startPolling();
        this.notifyUsersWhenStartOrStop('started');
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'started', validation: results }));
      } catch (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (err as Error).message })); }
      return;
    }

    if (pathname === '/stop') {
      if (!this.running) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'already_stopped' })); return; }
      this.stopPolling();
      this.notifyUsersWhenStartOrStop('paused');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'stopped' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' }));
  }
}
