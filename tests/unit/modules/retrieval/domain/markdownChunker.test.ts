import { describe, it, expect } from 'vitest';
import { chunkDocument, chunkSection, makeChunk, parseMarkdownSections } from '../../../../../src/modules/retrieval/domain/markdownChunker';
import { chunkId } from '../../../../../src/modules/vault/domain';

describe('markdownChunker', () => {
  // ── parseMarkdown ───────────────────────────────────────────────────
  describe('parseMarkdownSections', () => {
    const parse = parseMarkdownSections;

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

  // ── makeChunk / chunk ids ───────────────────────────────────────────
  describe('makeChunk', () => {
    it('uses the id given by the caller; heading and path stay in metadata', () => {
      const c = makeChunk('sample text', 'Week-01/file.md', 'Giới thiệu', 'Parent', chunkId('7f3c0000-0000-4000-8000-000000000001', 'a1b2c3d4e5f6', 7));
      expect(c.id).toBe('7f3c0000-0000-4000-8000-000000000001#a1b2c3d4#007');
      expect(c.source).toBe('Week-01/file.md');
      expect(c.heading).toBe('Giới thiệu');
      expect(c.parentHeading).toBe('Parent');
    });

    it('chunkDocument numbers chunks from 0 for each document', () => {
      let i = 0;
      const chunks = chunkDocument('a.md', ['## One', '', 'first', '', '## Two', '', 'second'].join('\n'), () => chunkId('doc-1', 'ffffffff00', i++));
      expect(chunks.map((c) => c.id)).toEqual(['doc-1#ffffffff#000', 'doc-1#ffffffff#001']);
    });
  });

  // ── chunkSection ────────────────────────────────────────────────────
  describe('chunkSection', () => {
    function chunk(text: string, src = 'test.md', heading = 'Section', parent = '') {
      let counter = 0;
      return chunkSection(text, src, heading, parent, () => `id-${counter++}`);
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
});
