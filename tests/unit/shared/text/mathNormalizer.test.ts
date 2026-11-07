import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { normalizeMathDelimiters } from '../../../../src/shared/text';
import { normalizeMathDelimiters as fromDocumentModule } from '../../../../src/modules/document';

interface MathFixture { name: string; input: string; expected: string }

// Shared with the C# client port (MathDelimiters.Normalize) — both must pass every case.
const FIXTURE_PATH = path.join(__dirname, '../../../fixtures/math-delimiters.json');
const fixtures = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as MathFixture[];

describe('normalizeMathDelimiters — strict (fixture tests/fixtures/math-delimiters.json)', () => {
  it('has enough cases', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
  });

  it.each(fixtures.map((f) => [f.name, f] as const))('%s', (_name, { input, expected }) => {
    expect(normalizeMathDelimiters(input, { mode: 'strict' })).toBe(expected);
  });

  it('is idempotent on every fixture output', () => {
    for (const { expected } of fixtures) expect(normalizeMathDelimiters(expected, { mode: 'strict' })).toBe(expected);
  });
});

describe('normalizeMathDelimiters — loose (default, PDF)', () => {
  it('is the default mode and still exported by the document module', () => {
    expect(fromDocumentModule).toBe(normalizeMathDelimiters);
    expect(normalizeMathDelimiters('giá trị \\text{mean}', { mode: 'loose' })).toBe(normalizeMathDelimiters('giá trị \\text{mean}'));
  });

  it('keeps existing $$...$$ untouched', () => {
    expect(normalizeMathDelimiters('Công thức $$E = mc^2$$ hiển thị')).toBe('Công thức $$E = mc^2$$ hiển thị');
  });

  it('keeps existing $...$ untouched and injects surrounding spaces', () => {
    expect(normalizeMathDelimiters('biến$x$tăng')).toBe('biến $x$ tăng');
  });

  it('converts \\[ ... \\] to $$...$$', () => {
    expect(normalizeMathDelimiters('xem \\[ a^2 + b^2 = c^2 \\]')).toBe('xem $$ a^2 + b^2 = c^2 $$');
  });

  it('converts \\( ... \\) to $...$', () => {
    expect(normalizeMathDelimiters('với \\( n > 1 \\)')).toBe('với $ n > 1 $');
  });

  it('splits align environments into multiple display rows', () => {
    const input = '\\begin{align} a &= 1 \\\\ b &= 2 \\end{align}';
    expect(normalizeMathDelimiters(input)).toBe('$$a = 1$$\n$$b = 2$$');
  });

  it('wraps bare \\text{...} commands', () => {
    expect(normalizeMathDelimiters('giá trị \\text{mean}')).toBe('giá trị $\\text{mean}$');
  });

  it('converts [LaTeX...] content to display math', () => {
    expect(normalizeMathDelimiters('tính [\\sqrt{x}]')).toContain('$$');
  });

  it('does not treat file citations as math', () => {
    expect(normalizeMathDelimiters('tham khảo [Week-01/QNX-Terminal-Commands.md]')).not.toContain('$$');
    expect(normalizeMathDelimiters('mở file (docs/v1.pdf)')).not.toContain('$');
  });

  it('keeps plain English sentences untouched', () => {
    const text = 'This is a long plain English sentence without any LaTeX commands.';
    expect(normalizeMathDelimiters(text)).toBe(text);
  });

  it('does not guess (…) as math when the ( follows a backslash', () => {
    expect(normalizeMathDelimiters('x \\( \\alpha)')).toBe('x \\( \\alpha)');
    expect(normalizeMathDelimiters('x (\\alpha)')).toBe('x $\\alpha$');
  });

  it('no longer touches fenced code blocks', () => {
    const text = '```bash\necho $HOME$x\nprintf "\\(a\\)" \\text{b}\n```\nrồi \\(y\\)';
    expect(normalizeMathDelimiters(text)).toBe('```bash\necho $HOME$x\nprintf "\\(a\\)" \\text{b}\n```\nrồi $y$');
  });

  it('no longer touches inline code spans', () => {
    expect(normalizeMathDelimiters('chạy `cp $SRC$DST` và `\\text{x}`')).toBe('chạy `cp $SRC$DST` và `\\text{x}`');
  });
});
