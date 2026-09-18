import * as http from 'http';
import { checkAuth } from '../middleware/auth';
import { handleVaultUpload } from './vaultUpload';
import type { HttpRouterContext, QueryParams } from '../context';

/**
 * `POST/GET/DELETE /api/vault/*` — moved verbatim from `src/api/server.ts`
 * (`handleVault`, Phase 1, mục 4.A / mục 6 Phase 1 step 1). Behavior unchanged.
 * Always terminates the response (caller only needs to check the `/api/vault`
 * prefix before invoking this, matching the original dispatch order).
 */
export async function handleVaultRouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  query: QueryParams,
  ctx: HttpRouterContext,
): Promise<void> {
  // Auth for write operations
  if ((req.method === 'POST' || req.method === 'DELETE') && !checkAuth(req)) {
    res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
  }

  // POST /api/vault/files — upload with hierarchies (formidable)
  if (pathname === '/api/vault/files' && req.method === 'POST') {
    await handleVaultUpload(req, res, ctx);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.writeHead(405, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Method not allowed' })); return;
  }

  try {
    const { createVaultStorageWithFallback } = await import('../../../modules/vault');

    // GET /api/vault/folders
    if (pathname === '/api/vault/folders' && req.method === 'GET') {
      const storage = await createVaultStorageWithFallback();
      const folders = await storage.listFolders();
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ folders }));
      return;
    }

    // GET /api/vault/chunks?file=&limit=&offset=  && GET /api/vault/files/:path/chunks
    if ((pathname === '/api/vault/chunks' || pathname.endsWith('/chunks')) && req.method === 'GET') {
      await handleVaultChunks(pathname, query, res, ctx);
      return;
    }

    // GET /api/vault/manifest (legacy compat) and GET /api/vault/files
    if ((pathname === '/api/vault/manifest' || pathname === '/api/vault/files') && req.method === 'GET' && !pathname.startsWith('/api/vault/files/')) {
      const storage = await createVaultStorageWithFallback();
      const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 1000);
      const offset = parseInt(query.offset ?? '0', 10) || 0;
      const indexed = query.indexed === 'true' ? true : query.indexed === 'false' ? false : undefined;
      const { entries, total } = await storage.list({ q: query.q, indexed, limit, offset, folder: query.folder });
      // legacy manifest compat: /api/vault/manifest returns {files: {...}}
      if (pathname === '/api/vault/manifest') {
        const files: Record<string, unknown> = {};
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
        if (entry.chunkIds.length > 0 && ctx.config.vaultConfig) {
          try {
            const { VectorStore } = await import('../../../rag/vectorStore');
            const vs = new VectorStore(ctx.config.vaultConfig.pineconeApiKey, ctx.config.vaultConfig.pineconeIndex);
            await vs.deleteByIds(entry.chunkIds);
          } catch {}
        }
        await storage.remove(filePath);
        // also remove from disk if exists
        try {
          const p = await import('path'); const fs = await import('fs');
          const vaultPath = ctx.config.vaultConfig?.vaultPath ?? './documents-vault';
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

async function handleVaultChunks(
  pathname: string,
  query: QueryParams,
  res: http.ServerResponse,
  ctx: HttpRouterContext,
): Promise<void> {
  const { createVaultStorageWithFallback } = await import('../../../modules/vault');
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
    let chunks: Record<string, unknown>[] = pagedIds.map((id, i) => ({ id, index: offset + i, indexed: entry.indexed }));
    // enrich with Pinecone metadata if indexed
    if (entry.indexed && pagedIds.length > 0 && ctx.config.vaultConfig) {
      try {
        const { VectorStore } = await import('../../../rag/vectorStore');
        const vs = new VectorStore(ctx.config.vaultConfig.pineconeApiKey, ctx.config.vaultConfig.pineconeIndex);
        const meta = await vs.fetchByIds(pagedIds);
        chunks = chunks.map(c => ({ ...c, ...(meta[c.id as string] ?? {}) }));
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
}
