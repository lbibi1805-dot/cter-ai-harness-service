import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileVaultRepository } from './fileVault.repository';

let rootDir: string;

function entry(filePath: string, indexed = false, content = 'x') {
  return { filePath, hash: `h-${filePath}`, chunkIds: [`${filePath}#0`], indexed, content };
}

describe('FileVaultRepository', () => {
  beforeEach(() => { rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-repo-')); });
  afterEach(() => fs.rmSync(rootDir, { recursive: true, force: true }));

  it('saves and reads back an entry with content', async () => {
    const repo = new FileVaultRepository(rootDir);
    await repo.save(entry('a/b.md', false, '# Hello'));
    const got = await repo.findByPath('a/b.md');
    expect(got).toMatchObject({ filePath: 'a/b.md', content: '# Hello', indexed: false, folderPath: 'a', depth: 1 });
  });

  it('persists across instances', async () => {
    await new FileVaultRepository(rootDir).save(entry('x.md'));
    expect(await new FileVaultRepository(rootDir).findByPath('x.md')).not.toBeNull();
  });

  it('searches by folder, text and indexed flag with paging', async () => {
    const repo = new FileVaultRepository(rootDir);
    await repo.save(entry('lab/a.md', true));
    await repo.save(entry('lab/b.md', false));
    await repo.save(entry('labx/c.md', true));
    await repo.save(entry('other.md', true));

    expect((await repo.search({ folder: 'lab', limit: 10, offset: 0 })).total).toBe(2);
    expect((await repo.search({ text: 'LABX', limit: 10, offset: 0 })).items.map((e) => e.filePath)).toEqual(['labx/c.md']);
    expect((await repo.search({ indexed: true, limit: 10, offset: 0 })).total).toBe(3);

    const paged = await repo.search({ limit: 2, offset: 1 });
    expect(paged.total).toBe(4);
    expect(paged.items.map((e) => e.filePath)).toEqual(['lab/b.md', 'labx/c.md']);
  });

  it('lists folders with rolled-up counts', async () => {
    const repo = new FileVaultRepository(rootDir);
    await repo.save(entry('a/b/c.md'));
    await repo.save(entry('a/d.md'));
    expect(await repo.listFolders()).toEqual([
      { path: 'a', depth: 1, fileCount: 2 },
      { path: 'a/b', depth: 2, fileCount: 1 },
    ]);
  });

  it('removes one entry or everything, and reports stats', async () => {
    const repo = new FileVaultRepository(rootDir);
    await repo.save(entry('a.md', true));
    await repo.save(entry('b.md', false));
    expect(await repo.stats()).toEqual({ total: 2, indexed: 1 });

    await repo.remove('a.md');
    expect(await repo.findByPath('a.md')).toBeNull();
    expect(await repo.stats()).toEqual({ total: 1, indexed: 0 });

    await repo.removeAll();
    expect(await repo.findAll()).toEqual([]);
  });
});
