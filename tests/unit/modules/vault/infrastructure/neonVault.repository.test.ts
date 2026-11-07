import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NeonVaultRepository } from '../../../../../src/modules/vault/infrastructure/neonVault.repository';
import { CachedVaultRepository } from '../../../../../src/modules/vault/infrastructure/cachedVault.repository';
import { VAULT_SCHEMA_STATEMENTS } from '../../../../../src/modules/vault/infrastructure/constants/vaultSchema.constants';
import { MARKDOWN_CONTENT_TYPE, VaultEntryStatus, VaultSourceType, type VaultVersion } from '../../../../../src/modules/vault/domain';
import { ConflictError } from '../../../../../src/shared/errors';
import { PgliteSqlClient } from '../../../../support/pgliteSqlClient';

const DOC_A = '11111111-1111-4111-8111-111111111111';
const DOC_B = '22222222-2222-4222-8222-222222222222';

function version(filePath: string, docId: string, hash: string): VaultVersion {
  return { filePath, docId, hash, objectKey: `vault/${docId}/${hash}.md`, sourceType: VaultSourceType.MARKDOWN, contentType: MARKDOWN_CONTENT_TYPE, sizeBytes: 10 };
}

describe('NeonVaultRepository (Postgres via PGlite)', () => {
  let sql: PgliteSqlClient;
  let repo: NeonVaultRepository;

  beforeAll(async () => { sql = new PgliteSqlClient(); });
  afterAll(async () => { await sql.close(); });
  beforeEach(async () => {
    await sql.db.exec('DROP TABLE IF EXISTS vault_manifest');
    repo = new NeonVaultRepository(sql);
    sql.resetCounters();
  }, 60_000); // PGlite boots its WASM on the first query

  it('applies the whole schema in ONE round-trip, once', async () => {
    await repo.stats();
    await repo.stats();
    expect(sql.statements[0]).toContain('CREATE TABLE IF NOT EXISTS vault_manifest');
    expect(sql.statements[0].split(';\n')).toHaveLength(VAULT_SCHEMA_STATEMENTS.length);
    expect(sql.roundTrips).toBe(3); // schema + 2 queries
  });

  it('upgrades a legacy table (content column, no doc_id) in place', async () => {
    await sql.db.exec(`CREATE TABLE vault_manifest (file_path TEXT PRIMARY KEY, hash TEXT NOT NULL, chunk_ids JSONB NOT NULL DEFAULT '[]',
      indexed BOOLEAN NOT NULL DEFAULT false, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      folder_path TEXT GENERATED ALWAYS AS (regexp_replace(file_path, '/[^/]+$', '')) STORED,
      depth INT GENERATED ALWAYS AS (length(file_path) - length(replace(file_path,'/',''))) STORED,
      content TEXT NOT NULL DEFAULT '')`);
    await sql.db.exec(`INSERT INTO vault_manifest (file_path, hash, chunk_ids, indexed, content) VALUES ('old.md', 'h', '["x_chunk_000"]', true, 'legacy'), ('old2.md', 'h2', '[]', false, '')`);
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ filePath: 'old.md', objectKey: '', status: VaultEntryStatus.ACTIVE, chunkIds: ['x_chunk_000'] });
    expect(all[0].docId).not.toBe(all[1].docId); // gen_random_uuid per row
  });

  it('saveVersion inserts, then updates keeping doc_id; commitIndexed only matches the current hash', async () => {
    const created = await repo.saveVersion(version('f/a.md', DOC_A, 'h1'));
    expect(created).toMatchObject({ docId: DOC_A, status: VaultEntryStatus.INDEXING, indexed: false, folderPath: 'f', depth: 1 });
    await repo.commitIndexed({ docId: DOC_A, hash: 'h1', chunkIds: [`${DOC_A}#h1000000#000`] });

    const updated = await repo.saveVersion(version('f/a.md', DOC_B, 'h2')); // a different docId in the request is ignored
    expect(updated).toMatchObject({ docId: DOC_A, hash: 'h2', indexedHash: 'h1', indexed: false, chunkIds: [`${DOC_A}#h1000000#000`] });
    expect(await repo.commitIndexed({ docId: DOC_A, hash: 'h1', chunkIds: [] })).toBeNull();      // stale version
    expect(await repo.commitIndexed({ docId: DOC_A, hash: 'h2', chunkIds: ['n'] })).toMatchObject({ indexedHash: 'h2', chunkIds: ['n'], status: VaultEntryStatus.ACTIVE });
    expect(await repo.markFailed(DOC_A, 'h2', 'boom')).toMatchObject({ status: VaultEntryStatus.FAILED, lastError: 'boom' });
  });

  it('deleting rows are hidden from reads; removal only happens in `deleting`', async () => {
    await repo.saveVersion(version('a.md', DOC_A, 'h1'));
    await repo.saveVersion(version('b.md', DOC_B, 'h2'));
    expect(await repo.removeDeleted(DOC_A)).toBe(false);
    expect((await repo.markDeleting('a.md'))?.status).toBe(VaultEntryStatus.DELETING);
    expect((await repo.findAll()).map((e) => e.filePath)).toEqual(['b.md']);
    expect((await repo.search({ limit: 10, offset: 0 })).total).toBe(1);
    expect(await repo.stats()).toEqual({ total: 1, indexed: 0 });
    expect((await repo.findByPath('a.md'))?.status).toBe(VaultEntryStatus.DELETING);
    expect((await repo.findDeleting()).map((e) => e.docId)).toEqual([DOC_A]);
    expect(await repo.removeDeleted(DOC_A)).toBe(true);
    expect(await repo.findByPath('a.md')).toBeNull();
  });

  it('folder delete escapes LIKE wildcards; rename detects conflicts', async () => {
    await repo.saveVersion(version('a_b/x.md', DOC_A, 'h1'));
    await repo.saveVersion(version('aXb/y.md', DOC_B, 'h2'));
    expect((await repo.markFolderDeleting('a_b')).map((e) => e.filePath)).toEqual(['a_b/x.md']);
    expect(await repo.removeAllDeleted()).toBe(1);
    await expect(repo.rename('aXb/y.md', 'aXb/y.md')).resolves.toMatchObject({ filePath: 'aXb/y.md' });
    await repo.saveVersion(version('z.md', DOC_A, 'h3'));
    await expect(repo.rename('z.md', 'aXb/y.md')).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.rename('z.md', 'w.md')).toMatchObject({ filePath: 'w.md', docId: DOC_A });
  });

  it('search pages with the total in the same query; folders count ancestors', async () => {
    for (let i = 0; i < 5; i++) await repo.saveVersion(version(`d/s/${i}.md`, `0000000${i}-0000-4000-8000-000000000000`, `h${i}`));
    sql.resetCounters();
    const page = await repo.search({ folder: 'd', limit: 2, offset: 2 });
    expect(page.items.map((e) => e.filePath)).toEqual(['d/s/2.md', 'd/s/3.md']);
    expect(page.total).toBe(5);
    expect(sql.roundTrips).toBe(1);
    expect(await repo.listFolders()).toEqual([{ path: 'd', depth: 1, fileCount: 5 }, { path: 'd/s', depth: 2, fileCount: 5 }]);
  });

  it('CachedVaultRepository: after one load, reads cost zero queries; writes go through', async () => {
    await repo.saveVersion(version('a.md', DOC_A, 'h1'));
    const cached = new CachedVaultRepository(repo);
    await cached.stats();
    sql.resetCounters();
    await cached.stats();
    await cached.search({ limit: 10, offset: 0 });
    await cached.findByPath('a.md');
    await cached.listFolders();
    expect(sql.roundTrips).toBe(0);
    expect(cached.peekByDocId(DOC_A)?.filePath).toBe('a.md');

    await cached.rename('a.md', 'b.md');
    expect(sql.roundTrips).toBe(1);
    expect(await cached.findByPath('a.md')).toBeNull();
    expect((await cached.findByPath('b.md'))?.docId).toBe(DOC_A);
    expect(sql.roundTrips).toBe(1);
  });
});
