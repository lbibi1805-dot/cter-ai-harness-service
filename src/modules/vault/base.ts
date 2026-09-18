import type { VaultEntry, VaultFolderSummary } from './dto';

/**
 * Shared pure helpers deduplicated from `PostgresVaultStorage` and
 * `NeonHttpVaultStorage`, which had ~87% identical `rowToEntry`/folder-expansion
 * logic (mục 1 / mục 4.A / mục 6 Phase 1 step 2). Extracted only after a
 * characterization test (`base.test.ts`) proved both implementations produced
 * byte-for-byte identical output for the same input rows.
 */

/** Generic SQL row shape both Postgres (`pg`) and Neon HTTP (`@neondatabase/serverless`)
 * return for the `vault_manifest` table — snake_case columns, `chunk_ids` as either
 * an already-parsed array (Neon) or a JSON string (pg driver default). */
export interface VaultManifestRow {
  file_path: string;
  hash: string;
  chunk_ids: unknown;
  indexed: boolean;
  updated_at: Date | string;
  folder_path?: string | null;
  depth?: number | null;
}

export function rowToVaultEntry(r: VaultManifestRow): VaultEntry {
  return {
    filePath: r.file_path,
    hash: r.hash,
    chunkIds: Array.isArray(r.chunk_ids) ? r.chunk_ids : JSON.parse((r.chunk_ids as string) ?? '[]'),
    indexed: r.indexed,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    folderPath: r.folder_path ?? (r.file_path.includes('/') ? r.file_path.replace(/\/[^/]+$/, '') : ''),
    depth: typeof r.depth === 'number' ? r.depth : (r.file_path.match(/\//g) || []).length,
  };
}

export interface GroupedFolderRow {
  path: string;
  file_count: number;
}

/** Expands directly-stored folder groupings (e.g. `a/b` with N files) into every
 * intermediate ancestor folder (`a`, `a/b`), summing file counts — identical logic
 * previously duplicated in both `PostgresVaultStorage.listFolders` and
 * `NeonHttpVaultStorage.listFolders`. */
export function expandFolderCounts(rows: GroupedFolderRow[]): VaultFolderSummary[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const parts = String(row.path).split('/');
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/');
      map.set(p, (map.get(p) ?? 0) + Number(row.file_count));
    }
  }
  return [...map.entries()]
    .map(([p, c]) => ({ path: p, depth: p.split('/').length, fileCount: c }))
    .sort((a, b) => a.path.localeCompare(b.path));
}
