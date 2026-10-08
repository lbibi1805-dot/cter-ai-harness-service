import * as fs from 'fs';
import * as path from 'path';
import {
  depthOf,
  folderPathOf,
  summarizeFolders,
  type NewVaultEntry,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
} from '../domain';

const MANIFEST_FILE_NAME = '.vault-manifest.json';
const DATA_DIR_NAME = 'data';

interface StoredEntry {
  hash: string;
  chunkIds: string[];
  indexed: boolean;
  updatedAt?: string;
  content?: string;
}

interface ManifestFile {
  files?: Record<string, StoredEntry>;
}

/**
 * Vault manifest kept in a local JSON file — the dev fallback when Neon is not
 * configured. Prefers `data/.vault-manifest.json` and mirrors writes to the
 * repo-root copy so older deployments keep reading the same data.
 */
export class FileVaultRepository implements VaultRepository {
  private readonly manifestPath: string;
  private readonly mirrorPath: string;
  private files: Record<string, StoredEntry> | null = null;

  constructor(rootDir: string = process.cwd()) {
    this.mirrorPath = path.resolve(rootDir, MANIFEST_FILE_NAME);
    this.manifestPath = resolveManifestPath(rootDir, this.mirrorPath);
  }

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    let entries = this.allEntries();
    if (criteria.folder) entries = entries.filter((e) => isInFolder(e.filePath, criteria.folder!));
    if (criteria.text) {
      const needle = criteria.text.toLowerCase();
      entries = entries.filter((e) => e.filePath.toLowerCase().includes(needle));
    }
    if (typeof criteria.indexed === 'boolean') entries = entries.filter((e) => e.indexed === criteria.indexed);
    return {
      items: entries.slice(criteria.offset, criteria.offset + criteria.limit),
      total: entries.length,
    };
  }

  async findAll(): Promise<VaultEntry[]> {
    return this.allEntries();
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    return this.allEntries().filter((e) => isInFolder(e.filePath, folder));
  }

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    const stored = this.load()[filePath];
    return stored ? toEntry(filePath, stored) : null;
  }

  async save(entry: NewVaultEntry): Promise<void> {
    this.load()[entry.filePath] = {
      hash: entry.hash,
      chunkIds: entry.chunkIds,
      indexed: entry.indexed,
      updatedAt: new Date().toISOString(),
      content: entry.content,
    };
    this.persist();
  }

  async remove(filePath: string): Promise<void> {
    delete this.load()[filePath];
    this.persist();
  }

  async removeAll(): Promise<void> {
    this.files = {};
    this.persist();
  }

  async listFolders(): Promise<VaultFolder[]> {
    const counts = new Map<string, number>();
    for (const filePath of Object.keys(this.load())) {
      const folder = folderPathOf(filePath);
      if (folder) counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return summarizeFolders([...counts.entries()].map(([folderPath, fileCount]) => ({ folderPath, fileCount })));
  }

  async stats(): Promise<VaultStats> {
    const stored = Object.values(this.load());
    return { total: stored.length, indexed: stored.filter((s) => s.indexed).length };
  }

  private allEntries(): VaultEntry[] {
    return Object.entries(this.load())
      .map(([filePath, stored]) => toEntry(filePath, stored))
      .sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  private load(): Record<string, StoredEntry> {
    if (this.files) return this.files;
    try {
      const raw = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8')) as ManifestFile;
      this.files = raw.files ?? {};
    } catch {
      this.files = {};
    }
    return this.files;
  }

  private persist(): void {
    const payload = JSON.stringify({ files: this.files ?? {} }, null, 2);
    for (const target of new Set([this.manifestPath, this.mirrorPath])) {
      try {
        fs.writeFileSync(target, payload);
      } catch {
        // Best-effort mirror; the primary manifest is what gets read back.
      }
    }
  }
}

function resolveManifestPath(rootDir: string, rootManifest: string): string {
  const dataDir = path.resolve(rootDir, DATA_DIR_NAME);
  if (!fs.existsSync(dataDir)) return rootManifest;
  const dataManifest = path.join(dataDir, MANIFEST_FILE_NAME);
  if (!fs.existsSync(dataManifest) && fs.existsSync(rootManifest)) {
    try {
      fs.copyFileSync(rootManifest, dataManifest);
    } catch {
      // Falls back to an empty manifest under data/.
    }
  }
  return dataManifest;
}

function isInFolder(filePath: string, folder: string): boolean {
  return filePath === folder || filePath.startsWith(`${folder}/`);
}

function toEntry(filePath: string, stored: StoredEntry): VaultEntry {
  return {
    filePath,
    hash: stored.hash,
    chunkIds: stored.chunkIds ?? [],
    indexed: !!stored.indexed,
    updatedAt: stored.updatedAt ?? new Date().toISOString(),
    content: stored.content ?? '',
    folderPath: folderPathOf(filePath),
    depth: depthOf(filePath),
  };
}
