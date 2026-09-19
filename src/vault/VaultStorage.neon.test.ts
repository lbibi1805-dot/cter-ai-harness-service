import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SqliteVaultStorage } from './SqliteVaultStorage';

const TMP_MANIFEST_DIR = path.resolve(process.cwd(), 'tmp-test-vault-storage');

function cleanTmp() {
  if (fs.existsSync(TMP_MANIFEST_DIR)) fs.rmSync(TMP_MANIFEST_DIR, { recursive: true });
  // also clean default manifest locations
  for (const p of [path.resolve(process.cwd(), '.vault-manifest.json'), path.resolve(process.cwd(), 'data/.vault-manifest.json')]) {
    if (fs.existsSync(p)) try { fs.rmSync(p); } catch {}
  }
}

describe('VaultStorage Neon-only — content field', () => {
  beforeEach(() => { cleanTmp(); fs.mkdirSync(TMP_MANIFEST_DIR, { recursive: true }); });
  afterEach(cleanTmp);

  it('upsert with content persists and get returns content', async () => {
    const s = new SqliteVaultStorage();
    await s.init();
    await s.upsert({ filePath: 'a/b.md', hash: 'h1', chunkIds: ['c1'], indexed: false, content: '# Hello\nworld' } as any);
    const got = await s.get('a/b.md');
    expect(got).not.toBeNull();
    expect(got!.content).toBe('# Hello\nworld');
    expect(got!.hash).toBe('h1');
    expect(got!.indexed).toBe(false);
  });

  it('upsert preserves content when not provided (back-compat)', async () => {
    const s = new SqliteVaultStorage();
    await s.init();
    await s.upsert({ filePath: 'x.md', hash: 'h1', chunkIds: [], indexed: false, content: 'first' } as any);
    // second upsert without content field — should keep old content
    await s.upsert({ filePath: 'x.md', hash: 'h2', chunkIds: ['c2'], indexed: true } as any);
    const got = await s.get('x.md');
    expect(got!.content).toBe('first');
    expect(got!.hash).toBe('h2');
    expect(got!.indexed).toBe(true);
  });

  it('list returns content for all entries', async () => {
    const s = new SqliteVaultStorage();
    await s.init();
    await s.upsert({ filePath: 'a.md', hash: 'h1', chunkIds: [], indexed: false, content: 'aaa' } as any);
    await s.upsert({ filePath: 'b.md', hash: 'h2', chunkIds: [], indexed: true, content: 'bbb' } as any);
    const { entries, total } = await s.list({ limit: 10, offset: 0 });
    expect(total).toBe(2);
    expect(entries.find(e => e.filePath === 'a.md')!.content).toBe('aaa');
    expect(entries.find(e => e.filePath === 'b.md')!.content).toBe('bbb');
  });

  it('stats counts indexed correctly with content present', async () => {
    const s = new SqliteVaultStorage();
    await s.init();
    await s.upsert({ filePath: 'a.md', hash: 'h1', chunkIds: [], indexed: false, content: 'a' } as any);
    await s.upsert({ filePath: 'b.md', hash: 'h2', chunkIds: [], indexed: true, content: 'b' } as any);
    const { total, indexed } = await s.stats();
    expect(total).toBe(2);
    expect(indexed).toBe(1);
  });

  it('remove deletes entry', async () => {
    const s = new SqliteVaultStorage();
    await s.init();
    await s.upsert({ filePath: 'del.md', hash: 'h', chunkIds: [], indexed: false, content: 'x' } as any);
    await s.remove('del.md');
    expect(await s.get('del.md')).toBeNull();
    const { total } = await s.stats();
    expect(total).toBe(0);
  });
});
