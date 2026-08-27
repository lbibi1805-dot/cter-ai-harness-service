import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeIndexer } from './knowledgeIndexer';
import type { IEmbeddingService } from './embeddingService';
import { VectorStore } from './vectorStore';
import type { VaultConfig } from '../types';

const TMP_DIR = path.resolve(process.cwd(), 'tmp-test-vault');
const MANIFEST_PATH = path.resolve(process.cwd(), '.vault-manifest.json');

function makeConfig(vaultPath: string): VaultConfig {
  return {
    vaultPath,
    pineconeApiKey: 'fake-key',
    pineconeIndex: 'test-index',
    embeddingProvider: 'gemini' as const,
    topK: 6,
  };
}

const mockEmbedder: IEmbeddingService = {
  dimension: 3072,
  provider: 'gemini',
  embed: async () => [],
  embedBatch: async () => [],
};

// Mock VectorStore that does nothing for testing manifest/detection logic
function mockVectorStore(): VectorStore {
  const vs = vi.mocked(new VectorStore('fake-key', 'test-index'));
  vs.ensureIndex = vi.fn().mockResolvedValue(undefined);
  vs.deleteByIds = vi.fn().mockResolvedValue(undefined);
  vs.upsertChunks = vi.fn().mockResolvedValue(undefined);
  return vs;
}

function writeFile(relative: string, content: string): string {
  const full = path.join(TMP_DIR, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf-8');
  return full;
}

function clean(): void {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true });
  if (fs.existsSync(MANIFEST_PATH)) fs.rmSync(MANIFEST_PATH);
}

describe('KnowledgeIndexer', () => {
  beforeEach(clean);
  afterEach(clean);

  // ── parseMarkdown ───────────────────────────────────────────────────
  describe('parseMarkdown', () => {
    function parse(content: string) {
      const idx = new KnowledgeIndexer(makeConfig(TMP_DIR), mockEmbedder);
      return (idx as any).parseMarkdown(content);
    }

    it('returns empty for empty content', () => {
      expect(parse('')).toEqual([]);
    });

    it('returns empty for text without ## headings', () => {
      expect(parse('plain text without headings')).toEqual([]);
    });

    it('parses ## heading as H2', () => {
      const sections = parse('## Section One\n\ncontent here');
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('Section One');
      expect(sections[0].parentHeading).toBe('');
      expect(sections[0].content).toContain('content here');
    });

    it('ignores more than two # (###, ####) as headings', () => {
      const sections = parse('### Subsection\n\ncontent');
      expect(sections).toHaveLength(0);
    });

    it('treats # heading as H1 (parent)', () => {
      const sections = parse('# Title\n## Chapter 1\n\nbody');
      expect(sections).toHaveLength(1);
      expect(sections[0].parentHeading).toBe('Title');
      expect(sections[0].heading).toBe('Chapter 1');
    });

    it('parses multiple sections', () => {
      const md = '# Doc\n## Part A\n\ntext a\n\n## Part B\n\ntext b';
      const sections = parse(md);
      expect(sections).toHaveLength(2);
      expect(sections[0].heading).toBe('Part A');
      expect(sections[1].heading).toBe('Part B');
    });

    it('skips empty sections', () => {
      const md = '## Empty\n\n## Real\n\nbody';
      const sections = parse(md);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('Real');
    });

    it('resets H2 when new H1 appears', () => {
      const md = '# Book\n## Chapter 1\n\nbody\n# Part Two\n## Chapter 2\n\nmore';
      const sections = parse(md);
      expect(sections).toHaveLength(2);
      expect(sections[0].parentHeading).toBe('Book');
      expect(sections[0].heading).toBe('Chapter 1');
      expect(sections[1].parentHeading).toBe('Part Two');
      expect(sections[1].heading).toBe('Chapter 2');
    });
  });

  // ── makeChunk ────────────────────────────────────────────────────────
  describe('makeChunk', () => {
    function make(source: string, heading: string, index: number) {
      const idx = new KnowledgeIndexer(makeConfig(TMP_DIR), mockEmbedder);
      return (idx as any).makeChunk('sample text', source, heading, '', index);
    }

    it('generates ID from source and heading', () => {
      const c = make('Week-01/file.md', 'Introduction', 0);
      expect(c.id).toContain('Week-01');
      expect(c.id).toContain('Introduction');
      expect(c.id).toContain('chunk_000');
    });

    it('sanitizes non-ASCII chars in ID', () => {
      const c = make('tài-liệu/note.md', 'Giới thiệu', 5);
      expect(c.id).not.toMatch(/[^\w-]/);
      expect(c.id).toContain('chunk_005');
    });

    it('sanitizes backslashes in source path', () => {
      const c = make('Week-02\\Lecture.md', 'Topic', 1);
      expect(c.id).toContain('Week-02');
      expect(c.id).toContain('Lecture');
      expect(c.id).not.toContain('\\');
    });

    it('uses sanitized heading for ID (max 30 chars)', () => {
      const c = make('file.md', 'A very long heading that should be truncated', 2);
      const parts = c.id.split('_');
      const headingPart = parts.slice(1, -2).join('-');
      expect(headingPart.length).toBeLessThanOrEqual(30);
    });

    it('falls back to source-only ID when heading is empty', () => {
      const c = make('file.md', '', 0);
      expect(c.id).toBe('file_chunk_000');
    });
  });

  // ── chunkSection ────────────────────────────────────────────────────
  describe('chunkSection', () => {
    function chunk(text: string, src = 'test.md', heading = 'Section', parent = '') {
      const idx = new KnowledgeIndexer(makeConfig(TMP_DIR), mockEmbedder);
      let counter = 0;
      return (idx as any).chunkSection(text, src, heading, parent, () => counter++);
    }

    it('returns single chunk for short text', () => {
      const chunks = chunk('Hello world');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe('Hello world');
    });

    it('assigns source and heading metadata', () => {
      const chunks = chunk('Small text', 'dir/file.md', 'My Heading', 'Parent');
      expect(chunks[0].source).toBe('dir/file.md');
      expect(chunks[0].heading).toBe('My Heading');
      expect(chunks[0].parentHeading).toBe('Parent');
    });

    it('splits long text into multiple chunks', () => {
      const paras: string[] = [];
      for (let i = 0; i < 50; i++) paras.push(`p${i}: ` + 'word '.repeat(80));
      const long = paras.join('\n\n');
      const chunks = chunk(long);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c: { text: string }) => c.text.length > 0)).toBe(true);
    });
  });

  // ── Manifest change detection ────────────────────────────────────────
  describe('indexAll — change detection', () => {
    async function runIndex(vaultPath: string) {
      const idx = new KnowledgeIndexer(
        makeConfig(vaultPath),
        mockEmbedder,
        mockVectorStore(),
      );
      await idx.indexAll();
    }

    it('creates manifest after first run', async () => {
      writeFile('a.md', '# A\n## Section\n\nhello');
      await runIndex(TMP_DIR);
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    });

    it('detects new file on second run', async () => {
      writeFile('a.md', '## One\n\ncontent');
      await runIndex(TMP_DIR);
      const before = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      writeFile('b.md', '## Two\n\nmore');
      try { await runIndex(TMP_DIR); } catch {}
      const after = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(Object.keys(after.files)).toContain('b.md');
      expect(Object.keys(after.files)).toContain('a.md');
    });

    it('skips unchanged files', async () => {
      writeFile('stable.md', '## Content\n\nsame');
      await runIndex(TMP_DIR);
      const before = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      const beforeHash = before.files['stable.md'].hash;
      // Re-run without any changes
      try { await runIndex(TMP_DIR); } catch {}
      const after = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(after.files['stable.md'].hash).toBe(beforeHash);
    });

    it('detects modified file by changed hash', async () => {
      writeFile('edit.md', '## V1\n\noriginal');
      await runIndex(TMP_DIR);
      const before = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      writeFile('edit.md', '## V2\n\nmodified');
      try { await runIndex(TMP_DIR); } catch {}
      const after = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(after.files['edit.md'].hash).not.toBe(before.files['edit.md'].hash);
    });

    it('handles deleted file in manifest', async () => {
      writeFile('gone.md', '## G\n\ntext');
      await runIndex(TMP_DIR);
      fs.rmSync(path.join(TMP_DIR, 'gone.md'));
      try { await runIndex(TMP_DIR); } catch {}
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(manifest.files['gone.md']).toBeUndefined();
    });

    it('reports all files changed when manifest is absent', async () => {
      writeFile('a.md', '## X\n\nok');
      await runIndex(TMP_DIR);
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(Object.keys(manifest.files)).toHaveLength(1);
    });
  });
});
