import { describe, it, expect } from 'vitest';
import {
  MAX_VAULT_PATH_LENGTH,
  depthOf,
  folderPathOf,
  isVaultPathTooLong,
  summarizeFolders,
  toVaultFilePath,
} from './vaultEntry';

describe('toVaultFilePath', () => {
  it('normalizes separators and strips leading slashes', () => {
    expect(toVaultFilePath('\\lab-1\\notes.md')).toBe('lab-1/notes.md');
    expect(toVaultFilePath('///a/b.md')).toBe('a/b.md');
  });

  it('removes parent-directory segments', () => {
    expect(toVaultFilePath('../../etc/passwd.md')).toBe('etc/passwd.md');
  });

  it('forces the markdown extension', () => {
    expect(toVaultFilePath('lab/readme.txt')).toBe('lab/readme.md');
    expect(toVaultFilePath('lab/readme.md')).toBe('lab/readme.md');
  });
});

describe('path helpers', () => {
  it('derives folder and depth', () => {
    expect(folderPathOf('a/b/c.md')).toBe('a/b');
    expect(folderPathOf('c.md')).toBe('');
    expect(depthOf('a/b/c.md')).toBe(2);
  });

  it('flags paths over the limit', () => {
    expect(isVaultPathTooLong('a'.repeat(MAX_VAULT_PATH_LENGTH))).toBe(false);
    expect(isVaultPathTooLong('a'.repeat(MAX_VAULT_PATH_LENGTH + 1))).toBe(true);
  });
});

describe('summarizeFolders', () => {
  it('rolls file counts up to every ancestor, sorted by path', () => {
    const folders = summarizeFolders([
      { folderPath: 'a/b', fileCount: 2 },
      { folderPath: 'a', fileCount: 1 },
      { folderPath: 'z', fileCount: 3 },
      { folderPath: '', fileCount: 9 },
    ]);
    expect(folders).toEqual([
      { path: 'a', depth: 1, fileCount: 3 },
      { path: 'a/b', depth: 2, fileCount: 2 },
      { path: 'z', depth: 1, fileCount: 3 },
    ]);
  });
});
