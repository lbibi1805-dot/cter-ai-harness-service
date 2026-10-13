import { describe, it, expect } from 'vitest';
import type { VaultEntry, VaultFolder } from '../../../vault';
import type { CitedChunk } from '../../../../types';
import { ListFolderTool, MAX_LISTED_ITEMS } from './listFolder.tool';
import { ReadDocumentTool, extractSection } from './readDocument.tool';
import { SEARCH_RESULTS_SHOWN, VaultSearchTool } from './vaultSearch.tool';

const DOC = [
  '# Lab 4',
  'intro',
  '## Mutex',
  'owner thread unlocks',
  '### Priority inheritance',
  'boosts the owner',
  '## Semaphore',
  'a counter',
].join('\n');

const entry = (filePath: string, content = DOC): VaultEntry => ({ filePath, content, hash: 'h', chunkIds: [], indexed: true, updatedAt: '' });
const chunk = (source: string, text: string, score = 0.8): CitedChunk => ({ chunkId: source, source, heading: 'H', parentHeading: '', text, tokenCount: 1, score });

describe('extractSection', () => {
  it('returns the section up to the next heading of the same or higher level, including sub-sections', () => {
    expect(extractSection(DOC, 'mutex')).toBe('## Mutex\nowner thread unlocks\n### Priority inheritance\nboosts the owner');
    expect(extractSection(DOC, 'Priority')).toBe('### Priority inheritance\nboosts the owner');
    expect(extractSection(DOC, 'semaphore')).toBe('## Semaphore\na counter');
    expect(extractSection(DOC, 'nope')).toBeNull();
  });
});

describe('ReadDocumentTool', () => {
  const tool = new ReadDocumentTool({ findByPath: async (p) => (p === 'lab-4/a.md' ? entry(p) : null) });

  it('reads a whole file and cites it', async () => {
    const result = await tool.execute({ path: 'lab-4/a.md' });
    expect(result.content).toContain('a counter');
    expect(result.sources).toEqual(['lab-4/a.md']);
  });

  it('reads one section by heading', async () => {
    const result = await tool.execute({ path: 'lab-4/a.md', heading: 'Semaphore' });
    expect(result.content).toContain('## Semaphore\na counter');
    expect(result.content).not.toContain('owner thread');
  });

  it('lists available headings when the heading is missing (and cites nothing)', async () => {
    const result = await tool.execute({ path: 'lab-4/a.md', heading: 'Barrier' });
    expect(result.content).toContain('Available headings: Lab 4 | Mutex | Priority inheritance | Semaphore');
    expect(result.sources).toEqual([]);
  });

  it('never reads outside the vault store', async () => {
    const result = await tool.execute({ path: '../../.env' });
    expect(result.content).toMatch(/File not found in the vault/);
    expect(result.sources).toEqual([]);
  });

  it('requires a path', async () => {
    await expect(tool.execute({})).rejects.toThrow('"path" is required');
  });
});

describe('VaultSearchTool', () => {
  const results = [
    chunk('lab-4/Mutex.md', 'mutex text', 0.81),
    chunk('lab-6/IPC.md', 'ipc text'),
    chunk('lab-4/Mutex.md', 'more mutex'),
    ...Array.from({ length: 6 }, (_, i) => chunk(`other/${i}.md`, `noise ${i}`)),
  ];
  const tool = new VaultSearchTool({ search: async () => results });

  it(`formats at most ${SEARCH_RESULTS_SHOWN} passages with file, heading and relevance`, async () => {
    const result = await tool.execute({ query: 'mutex' });
    expect(result.content).toContain('[1] file: lab-4/Mutex.md | heading: H | relevance: 81%');
    expect(result.content.match(/^\[\d\]/gm)).toHaveLength(SEARCH_RESULTS_SHOWN);
    expect(result.sources).toEqual(['lab-4/Mutex.md', 'lab-6/IPC.md', 'other/0.md', 'other/1.md']);
  });

  it('filters by folder', async () => {
    const result = await tool.execute({ query: 'mutex', folder: 'lab-4' });
    expect(result.sources).toEqual(['lab-4/Mutex.md']);
  });

  it('suggests rephrasing when nothing matches', async () => {
    const result = await new VaultSearchTool({ search: async () => [] }).execute({ query: 'mutex' });
    expect(result.content).toMatch(/other language/);
    expect(result.sources).toEqual([]);
  });
});

describe('ListFolderTool', () => {
  const folders: VaultFolder[] = Array.from({ length: MAX_LISTED_ITEMS + 5 }, (_, i) => ({ path: `f${i}`, depth: 1, fileCount: 2 }));
  const tool = new ListFolderTool({
    listFolders: async () => folders,
    findByFolder: async (f) => (f === 'lab-4' ? [entry('lab-4/a.md'), entry('lab-4/b.md')] : []),
  });

  it('lists folders with a cap, and never counts listings as sources', async () => {
    const result = await tool.execute({});
    expect(result.content).toContain('f0 (2 files)');
    expect(result.content).toContain('…and 5 more folders');
    expect(result.sources).toEqual([]);
  });

  it('lists files in a folder', async () => {
    expect((await tool.execute({ folder: 'lab-4' })).content).toBe('lab-4/a.md\nlab-4/b.md');
    expect((await tool.execute({ folder: 'missing' })).content).toMatch(/empty or does not exist/);
  });
});
