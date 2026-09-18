import * as http from 'http';
import type { HttpRouterContext } from '../context';

/**
 * `POST /api/vault/files` upload handling (formidable multi-file, hierarchy-preserving)
 * — split out of `vault.ts` to stay under the ~150-line-per-file guideline (mục 2.2).
 * Moved verbatim from `src/api/server.ts`'s `handleVault` (Phase 1, mục 4.A).
 */
export async function handleVaultUpload(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: HttpRouterContext,
): Promise<void> {
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
    const { normalizeText } = await import('../../../rag/textNormalizer');
    const { createVaultStorageWithFallback } = await import('../../../modules/vault');
    const vaultPath = ctx.config.vaultConfig?.vaultPath ?? './documents-vault';
    const storage = await createVaultStorageWithFallback();
    const absVault = path.resolve(process.cwd(), vaultPath);
    if (!fs.existsSync(absVault)) fs.mkdirSync(absVault, { recursive: true });

    const results: Record<string, unknown>[] = [];
    for (const f of rawFiles) {
      // Preserve hierarchies: use webkitRelativePath / originalFilename with slashes
      let rel = String(f.originalFilename ?? f.newFilename ?? 'file.md');
      // formidable v3 may put relative path in originalFilename; also check field 'path' or custom header
      const fieldRel = (fields as Record<string, unknown>).path ?? (fields as Record<string, unknown>).webkitRelativePath;
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
}
