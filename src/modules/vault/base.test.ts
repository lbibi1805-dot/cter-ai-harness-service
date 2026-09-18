import { describe, it, expect } from 'vitest';
import { rowToVaultEntry, expandFolderCounts } from './base';

/**
 * Comparison test required by PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 1 step 2:
 * proves the extracted shared `rowToVaultEntry`/`expandFolderCounts` produce
 * byte-for-byte identical output to what `PostgresVaultStorage` and
 * `NeonHttpVaultStorage`'s own (now-removed) private `rowToEntry`/folder-expansion
 * logic used to compute — written BEFORE those classes were switched over to the
 * shared helpers (base.ts), per the plan's "trước khi gộp, viết test đối chiếu
 * output" requirement.
 *
 * The reference implementations below are frozen copies of the original
 * per-class private logic (both were verbatim-identical to each other already).
 */
function referenceRowToEntry(r: Record<string, unknown>) {
  return {
    filePath: r.file_path as string,
    hash: r.hash as string,
    chunkIds: Array.isArray(r.chunk_ids) ? r.chunk_ids : JSON.parse((r.chunk_ids as string) ?? '[]'),
    indexed: r.indexed as boolean,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    folderPath: r.folder_path ?? ((r.file_path as string).includes('/') ? (r.file_path as string).replace(/\/[^/]+$/, '') : ''),
    depth: typeof r.depth === 'number' ? r.depth : ((r.file_path as string).match(/\//g) || []).length,
  };
}

function referenceExpandFolderCounts(rows: { path: string; file_count: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const parts = String(row.path).split('/');
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join('/');
      map.set(p, (map.get(p) ?? 0) + Number(row.file_count));
    }
  }
  return [...map.entries()].map(([p, c]) => ({ path: p, depth: p.split('/').length, fileCount: c })).sort((a, b) => a.path.localeCompare(b.path));
}

describe('modules/vault base — parity with the pre-merge Postgres/Neon private logic', () => {
  const rows = [
    { file_path: 'notes/a.md', hash: 'h1', chunk_ids: ['c1', 'c2'], indexed: true, updated_at: new Date('2026-01-01T00:00:00Z') },
    { file_path: 'notes/a.md', hash: 'h1', chunk_ids: '["c1","c2"]', indexed: true, updated_at: '2026-01-01T00:00:00.000Z' }, // pg-style string JSON + string timestamp (Neon shape)
    { file_path: 'root.md', hash: 'h2', chunk_ids: [], indexed: false, updated_at: new Date('2026-02-01T00:00:00Z') },
    { file_path: 'deep/nested/folder/file.md', hash: 'h3', chunk_ids: [], indexed: false, updated_at: new Date(), folder_path: 'deep/nested/folder', depth: 3 },
  ];

  it.each(rows)('rowToVaultEntry matches the frozen reference implementation for %j', (row) => {
    expect(rowToVaultEntry(row as never)).toEqual(referenceRowToEntry(row));
  });

  it('expandFolderCounts matches the frozen reference implementation for a typical grouped result set', () => {
    const grouped = [
      { path: 'a', file_count: 2 },
      { path: 'a/b', file_count: 3 },
      { path: 'a/b/c', file_count: 1 },
      { path: 'x', file_count: 5 },
    ];
    expect(expandFolderCounts(grouped)).toEqual(referenceExpandFolderCounts(grouped));
  });

  it('expandFolderCounts matches the frozen reference implementation for an empty result set', () => {
    expect(expandFolderCounts([])).toEqual(referenceExpandFolderCounts([]));
  });
});
