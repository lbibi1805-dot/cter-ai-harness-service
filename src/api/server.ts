import * as http from 'http';
import type { AppConfig } from '../types';
import { validateAllKeys, type KeyValidationResult } from '../ai/aiRouter';
import { EmailNotifier } from '../utils/emailNotifier';
import { logger } from '../utils/logger';

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
  const allowed = (process.env.FRONTEND_URL ?? process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin ?? '';
  if (allowed.length === 0) {
    // dev: allow all when not configured (handshake via env only for deploy)
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowed[0]);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Vary', 'Origin');
}

function checkAuth(req: http.IncomingMessage): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  const auth = req.headers.authorization ?? '';
  return auth === `Bearer ${token}`;
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
        if (!checkAuth(req)) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return; }
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

    // Vault API: need POST/DELETE support, so check vault prefix before GET-only guard
    if (pathname.startsWith('/api/vault')) {
      await this.handleVault(req, res, pathname, query);
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
          const { createVaultStorageWithFallback } = await import('../vault');
          const storage = await createVaultStorageWithFallback();
          const { total, indexed } = await storage.stats();
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

  private async handleVault(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, query: Record<string, string>): Promise<void> {
    // Auth for write operations
    if ((req.method === 'POST' || req.method === 'DELETE') && !checkAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
    }

    // POST /api/vault/files — upload with hierarchies (formidable)
    if (pathname === '/api/vault/files' && req.method === 'POST') {
      try {
        const formidable = await import('formidable');
        const form = formidable.default ? formidable.default({ multiples: true, maxFileSize: 50 * 1024 * 1024 }) : (formidable as any)({ multiples: true });
        const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
          (form as any).parse(req, (err: any, f: any, fl: any) => err ? reject(err) : resolve({ fields: f, files: fl }));
        });
        const rawFiles: any[] = [];
        for (const v of Object.values(files as Record<string, any>)) {
          if (Array.isArray(v)) rawFiles.push(...v); else if (v) rawFiles.push(v);
        }
        if (rawFiles.length === 0) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No files' })); return; }

        const fs = await import('fs');
        const path = await import('path');
        const crypto = await import('crypto');
        const { normalizeText } = await import('../rag/textNormalizer');
        const { createVaultStorageWithFallback } = await import('../vault');
        const vaultPath = this.config.vaultConfig?.vaultPath ?? './documents-vault';
        const storage = await createVaultStorageWithFallback();
        const absVault = path.resolve(process.cwd(), vaultPath);
        if (!fs.existsSync(absVault)) fs.mkdirSync(absVault, { recursive: true });

        const results: any[] = [];
        for (const f of rawFiles) {
          // Preserve hierarchies: use webkitRelativePath / originalFilename with slashes
          let rel = String(f.originalFilename ?? f.newFilename ?? 'file.md');
          // formidable v3 may put relative path in originalFilename; also check field 'path' or custom header
          const fieldRel = (fields as any).path ?? (fields as any).webkitRelativePath;
          if (fieldRel) {
            const first = Array.isArray(fieldRel) ? fieldRel[0] : fieldRel;
            if (typeof first === 'string' && first.includes('/')) rel = first;
          }
          // Sanitize: remove .. and leading /
          rel = rel.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.\//g, '');
          if (!rel.endsWith('.md')) rel = rel.replace(/\.[^.]+$/, '.md');
          if (rel.length > 1024) { results.push({ file: rel, error: 'path too long' }); continue; }
          const content = fs.readFileSync(f.filepath, 'utf-8');
          const normalized = normalizeText(content);
          const hash = crypto.createHash('md5').update(normalized).digest('hex');
          const dest = path.join(absVault, rel);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, content);
          await storage.upsert({ filePath: rel, hash, chunkIds: [], indexed: false });
          results.push({ file: rel, hash, indexed: false });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, files: results }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (e as Error).message }));
      }
      return;
    }

    if (req.method !== 'GET' && req.method !== 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Method not allowed' })); return;
    }

    try {
      const { createVaultStorageWithFallback } = await import('../vault');

      // GET /api/vault/folders
      if (pathname === '/api/vault/folders' && req.method === 'GET') {
        const storage = await createVaultStorageWithFallback();
        const folders = await storage.listFolders();
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ folders }));
        return;
      }

      // GET /api/vault/chunks?file=&limit=&offset=  && GET /api/vault/files/:path/chunks
      if ((pathname === '/api/vault/chunks' || pathname.endsWith('/chunks')) && req.method === 'GET') {
        const storage = await createVaultStorageWithFallback();
        let filePath = query.file as string | undefined;
        // /api/vault/files/:path/chunks
        if (pathname.startsWith('/api/vault/files/') && pathname.endsWith('/chunks')) {
          filePath = decodeURIComponent(pathname.slice('/api/vault/files/'.length, -'/chunks'.length));
        }
        if (filePath) {
          const entry = await storage.get(filePath);
          if (!entry) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'File not found' })); return; }
          const ids = entry.chunkIds;
          const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);
          const offset = parseInt(query.offset ?? '0', 10) || 0;
          const pagedIds = ids.slice(offset, offset + limit);
          let chunks: any[] = pagedIds.map((id, i) => ({ id, index: offset + i, indexed: entry.indexed }));
          // enrich with Pinecone metadata if indexed
          if (entry.indexed && pagedIds.length > 0 && this.config.vaultConfig) {
            try {
              const { VectorStore } = await import('../rag/vectorStore');
              const vs = new VectorStore(this.config.vaultConfig.pineconeApiKey, this.config.vaultConfig.pineconeIndex);
              const meta = await vs.fetchByIds(pagedIds);
              chunks = chunks.map(c => ({ ...c, ...(meta[c.id] ?? {}) }));
            } catch {}
          }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ file: filePath, total: ids.length, limit, offset, chunks }));
          return;
        }
        // list all chunks (aggregate chunkIds from manifest)
        const { entries } = await storage.list({ limit: 10000, offset: 0 });
        const allIds = entries.flatMap(e => e.chunkIds);
        const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);
        const offset = parseInt(query.offset ?? '0', 10) || 0;
        const pagedIds = allIds.slice(offset, offset + limit);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ total: allIds.length, limit, offset, chunkIds: pagedIds }));
        return;
      }

      // GET /api/vault/manifest (legacy compat) and GET /api/vault/files
      if ((pathname === '/api/vault/manifest' || pathname === '/api/vault/files') && req.method === 'GET' && !pathname.startsWith('/api/vault/files/')) {
        const storage = await createVaultStorageWithFallback();
        const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 100);
        const offset = parseInt(query.offset ?? '0', 10) || 0;
        const indexed = query.indexed === 'true' ? true : query.indexed === 'false' ? false : undefined;
        const { entries, total } = await storage.list({ q: query.q, indexed, limit, offset, folder: query.folder });
        // legacy manifest compat: /api/vault/manifest returns {files: {...}}
        if (pathname === '/api/vault/manifest') {
          const files: Record<string, any> = {};
          for (const e of entries) files[e.filePath] = { hash: e.hash, chunkIds: e.chunkIds, indexed: e.indexed, updatedAt: e.updatedAt, folderPath: e.folderPath, depth: e.depth };
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ files, total }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ files: entries, total, limit, offset }));
        return;
      }

      // GET /api/vault/files/:path  and DELETE /api/vault/files/:path
      const prefix = '/api/vault/files/';
      if (pathname.startsWith(prefix)) {
        const filePath = decodeURIComponent(pathname.slice(prefix.length));
        const storage = await createVaultStorageWithFallback();
        if (req.method === 'GET') {
          const entry = await storage.get(filePath);
          if (!entry) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(entry));
          return;
        }
        if (req.method === 'DELETE') {
          const entry = await storage.get(filePath);
          if (!entry) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' })); return; }
          // delete vectors if indexed
          if (entry.chunkIds.length > 0 && this.config.vaultConfig) {
            try {
              const { VectorStore } = await import('../rag/vectorStore');
              const vs = new VectorStore(this.config.vaultConfig.pineconeApiKey, this.config.vaultConfig.pineconeIndex);
              await vs.deleteByIds(entry.chunkIds);
            } catch {}
          }
          await storage.remove(filePath);
          // also remove from disk if exists
          try {
            const p = await import('path'); const fs = await import('fs');
            const vaultPath = this.config.vaultConfig?.vaultPath ?? './documents-vault';
            const abs = p.resolve(process.cwd(), vaultPath, filePath);
            if (fs.existsSync(abs)) fs.unlinkSync(abs);
          } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
          return;
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: (e as Error).message }));
    }
  }
}
