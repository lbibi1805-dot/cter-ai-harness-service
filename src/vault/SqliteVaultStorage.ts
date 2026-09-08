import * as fs from 'fs';
import * as path from 'path';
import type { VaultEntry, VaultStorage } from './VaultStorage';

const MANIFEST_NAME = '.vault-manifest.json';

function getManifestPath(): string {
  const dataManifest = path.resolve(process.cwd(), 'data', MANIFEST_NAME);
  const rootManifest = path.resolve(process.cwd(), MANIFEST_NAME);
  if (fs.existsSync(path.resolve(process.cwd(), 'data'))) {
    if (!fs.existsSync(dataManifest) && fs.existsSync(rootManifest)) {
      try { fs.copyFileSync(rootManifest, dataManifest); } catch {}
    }
    return dataManifest;
  }
  return rootManifest;
}

export class SqliteVaultStorage implements VaultStorage {
  private manifestPath = getManifestPath();
  private data: Record<string, { hash: string; chunkIds: string[]; indexed: boolean; updatedAt?: string }> = {};

  async init(): Promise<void> {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const raw = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
        this.data = raw.files ?? {};
      }
    } catch { this.data = {}; }
  }

  private persist(): void {
    const payload = { files: this.data };
    try { fs.writeFileSync(this.manifestPath, JSON.stringify(payload, null, 2)); } catch {}
    try {
      const alt = path.resolve(process.cwd(), MANIFEST_NAME);
      if (alt !== this.manifestPath) fs.writeFileSync(alt, JSON.stringify(payload, null, 2));
    } catch {}
  }

  private toEntry(filePath: string, v: any): VaultEntry {
    const folderPath = filePath.includes('/') ? filePath.replace(/\/[^/]+$/, '') : '';
    const depth = (filePath.match(/\//g) || []).length;
    return { filePath, hash: v.hash, chunkIds: v.chunkIds ?? [], indexed: !!v.indexed, updatedAt: v.updatedAt ?? new Date().toISOString(), folderPath, depth };
  }

  async list(opts?: { folder?: string; q?: string; indexed?: boolean; limit?: number; offset?: number }): Promise<{ entries: VaultEntry[]; total: number }> {
    let entries = Object.entries(this.data).map(([k, v]) => this.toEntry(k, v));
    if (opts?.folder) entries = entries.filter(e => e.filePath === opts.folder || e.filePath.startsWith(opts.folder + '/'));
    if (opts?.q) {
      const q = opts.q.toLowerCase();
      entries = entries.filter(e => e.filePath.toLowerCase().includes(q));
    }
    if (typeof opts?.indexed === 'boolean') entries = entries.filter(e => e.indexed === opts.indexed);
    entries.sort((a, b) => a.filePath.localeCompare(b.filePath));
    const total = entries.length;
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 50;
    return { entries: entries.slice(offset, offset + limit), total };
  }

  async get(filePath: string): Promise<VaultEntry | null> {
    const v = this.data[filePath];
    return v ? this.toEntry(filePath, v) : null;
  }

  async upsert(entry: Omit<VaultEntry, 'updatedAt' | 'folderPath' | 'depth'>): Promise<void> {
    this.data[entry.filePath] = { hash: entry.hash, chunkIds: entry.chunkIds, indexed: entry.indexed, updatedAt: new Date().toISOString() };
    this.persist();
  }

  async remove(filePath: string): Promise<void> {
    delete this.data[filePath];
    this.persist();
  }

  async listFolders(): Promise<{ path: string; depth: number; fileCount: number }[]> {
    const map = new Map<string, number>();
    for (const fp of Object.keys(this.data)) {
      const parts = fp.split('/');
      for (let i = 1; i < parts.length; i++) {
        const folder = parts.slice(0, i).join('/');
        map.set(folder, (map.get(folder) ?? 0) + 1);
      }
    }
    return [...map.entries()].map(([p, c]) => ({ path: p, depth: p.split('/').length, fileCount: c })).sort((a, b) => a.path.localeCompare(b.path));
  }

  async stats(): Promise<{ total: number; indexed: number }> {
    const total = Object.keys(this.data).length;
    const indexed = Object.values(this.data).filter(v => v.indexed).length;
    return { total, indexed };
  }
}
