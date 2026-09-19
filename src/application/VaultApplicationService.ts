import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { normalizeText } from '../rag/textNormalizer';
import { createVaultStorageWithFallback } from '../vault';
import { VectorStore } from '../rag/vectorStore';
import type { VaultConfig } from '../types';
import type { ILogger } from '../domain/ports/ILogger';

export class VaultApplicationService {
  constructor(private vaultConfig: VaultConfig | undefined, private logger: ILogger) {}

  async listFiles(opts: { q?: string; indexed?: boolean; limit?: number; offset?: number; folder?: string }) {
    const storage = await createVaultStorageWithFallback();
    return storage.list(opts);
  }

  async getFile(filePath: string) {
    const storage = await createVaultStorageWithFallback();
    return storage.get(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const storage = await createVaultStorageWithFallback();
    const entry = await storage.get(filePath);
    if (!entry) throw new Error('Not found');
    if (entry.chunkIds.length > 0 && this.vaultConfig) {
      try {
        const vs = new VectorStore(this.vaultConfig.pineconeApiKey, this.vaultConfig.pineconeIndex);
        await vs.deleteByIds(entry.chunkIds);
      } catch {}
    }
    await storage.remove(filePath);
    try {
      const vaultPath = this.vaultConfig?.vaultPath ?? './documents-vault';
      const abs = path.resolve(process.cwd(), vaultPath, filePath);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}
  }

  async uploadFiles(files: { originalFilename: string; filepath: string; content?: string }[], pathHint?: string) {
    const { normalizeText: nt } = await import('../rag/textNormalizer');
    const storage = await createVaultStorageWithFallback();
    const vaultPath = this.vaultConfig?.vaultPath ?? './documents-vault';
    const absVault = path.resolve(process.cwd(), vaultPath);
    if (!fs.existsSync(absVault)) fs.mkdirSync(absVault, { recursive: true });
    const results: any[] = [];
    for (const f of files) {
      let rel = String(f.originalFilename ?? 'file.md');
      if (pathHint && pathHint.includes('/')) rel = pathHint;
      rel = rel.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.\//g, '');
      if (!rel.endsWith('.md')) rel = rel.replace(/\.[^.]+$/, '.md');
      const content = f.content ?? fs.readFileSync(f.filepath, 'utf-8');
      const normalized = nt(content);
      const hash = crypto.createHash('md5').update(normalized).digest('hex');
      const dest = path.join(absVault, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
      await storage.upsert({ filePath: rel, hash, chunkIds: [], indexed: false });
      results.push({ file: rel, hash, indexed: false });
    }
    return results;
  }

  async listFolders() {
    const storage = await createVaultStorageWithFallback();
    return storage.listFolders();
  }

  async listChunks(filePath?: string, limit = 50, offset = 0) {
    const storage = await createVaultStorageWithFallback();
    if (filePath) {
      const entry = await storage.get(filePath);
      if (!entry) throw new Error('File not found');
      const ids = entry.chunkIds;
      const pagedIds = ids.slice(offset, offset + limit);
      let chunks: any[] = pagedIds.map((id, i) => ({ id, index: offset + i, indexed: entry.indexed }));
      if (entry.indexed && pagedIds.length > 0 && this.vaultConfig) {
        try {
          const vs = new VectorStore(this.vaultConfig.pineconeApiKey, this.vaultConfig.pineconeIndex);
          const meta = await vs.fetchByIds(pagedIds);
          chunks = chunks.map(c => ({ ...c, ...(meta[c.id] ?? {}) }));
        } catch {}
      }
      return { file: filePath, total: ids.length, limit, offset, chunks };
    }
    const { entries } = await storage.list({ limit: 10000, offset: 0 });
    const allIds = entries.flatMap(e => e.chunkIds);
    const pagedIds = allIds.slice(offset, offset + limit);
    return { total: allIds.length, limit, offset, chunkIds: pagedIds };
  }
}
