import type { NeonSql } from '../../../src/shared/database/database';
import {
  depthOf,
  folderPathOf,
  summarizeFolders,
  type PagedResult,
  type VaultEntry,
  type VaultFolder,
  type VaultRepository,
  type VaultSearchCriteria,
  type VaultStats,
} from '../../../src/modules/vault/domain';
import type { ReferenceLoader } from '../application/ports';

/** Max characters of each reference document handed to the judge. */
export const REFERENCE_CHARS_PER_FILE = 8_000;

interface Row {
  file_path: string;
  hash: string;
  chunk_ids: string[] | string | null;
  indexed: boolean;
  updated_at: Date | string;
  content: string | null;
}

/**
 * Vault access for evaluation against PRODUCTION: plain SELECTs only. Unlike
 * NeonVaultRepository it never runs schema DDL, and every write throws.
 */
export class ReadOnlyNeonVaultRepository implements VaultRepository {
  constructor(private readonly sql: NeonSql) {}

  async findByPath(filePath: string): Promise<VaultEntry | null> {
    const rows = (await this.sql.query('SELECT * FROM vault_manifest WHERE file_path = $1', [filePath])) as Row[];
    return rows[0] ? toEntry(rows[0]) : null;
  }

  async findByFolder(folder: string): Promise<VaultEntry[]> {
    const rows = (await this.sql.query(
      'SELECT * FROM vault_manifest WHERE file_path = $1 OR file_path LIKE $2 ORDER BY file_path',
      [folder, `${folder}/%`],
    )) as Row[];
    return rows.map(toEntry);
  }

  async findAll(): Promise<VaultEntry[]> {
    return ((await this.sql.query('SELECT * FROM vault_manifest ORDER BY file_path')) as Row[]).map(toEntry);
  }

  async search(criteria: VaultSearchCriteria): Promise<PagedResult<VaultEntry>> {
    const all = await this.findAll();
    return { items: all.slice(criteria.offset, criteria.offset + criteria.limit), total: all.length };
  }

  async listFolders(): Promise<VaultFolder[]> {
    const rows = (await this.sql.query('SELECT file_path FROM vault_manifest')) as Array<{ file_path: string }>;
    const counts = new Map<string, number>();
    for (const { file_path } of rows) {
      const folder = folderPathOf(file_path);
      if (folder) counts.set(folder, (counts.get(folder) ?? 0) + 1);
    }
    return summarizeFolders([...counts.entries()].map(([folderPath, fileCount]) => ({ folderPath, fileCount })));
  }

  async stats(): Promise<VaultStats> {
    const rows = (await this.sql.query(
      'SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE indexed)::int AS indexed FROM vault_manifest',
    )) as VaultStats[];
    return rows[0];
  }

  async save(): Promise<void> { throw readOnly('save'); }
  async remove(): Promise<void> { throw readOnly('remove'); }
  async removeAll(): Promise<void> { throw readOnly('removeAll'); }
}

/** Concatenates the expected source documents as the judge's ground truth. */
export class VaultReferenceLoader implements ReferenceLoader {
  constructor(private readonly repository: Pick<VaultRepository, 'findByPath'>) {}

  async load(paths: string[]): Promise<string> {
    const parts: string[] = [];
    for (const filePath of paths) {
      const entry = await this.repository.findByPath(filePath);
      const content = entry?.content?.trim();
      parts.push(content
        ? `### SOURCE: ${filePath}\n${content.slice(0, REFERENCE_CHARS_PER_FILE)}`
        : `### SOURCE: ${filePath}\n(missing from the vault — fix the golden label)`);
    }
    return parts.join('\n\n');
  }
}

function readOnly(operation: string): Error {
  return new Error(`ReadOnlyNeonVaultRepository.${operation}: the evaluation never writes to production`);
}

function toEntry(row: Row): VaultEntry {
  return {
    filePath: row.file_path,
    hash: row.hash,
    chunkIds: Array.isArray(row.chunk_ids) ? row.chunk_ids : JSON.parse(row.chunk_ids ?? '[]'),
    indexed: row.indexed,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    content: row.content ?? '',
    folderPath: folderPathOf(row.file_path),
    depth: depthOf(row.file_path),
  };
}
