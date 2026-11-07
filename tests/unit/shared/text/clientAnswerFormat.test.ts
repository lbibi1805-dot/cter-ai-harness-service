import { describe, it, expect } from 'vitest';
import { formatAnswerForClient, sanitizeMermaidGlyphs } from '../../../../src/shared/text';

describe('formatAnswerForClient', () => {
  it('sanitizes stray glyph lines only inside mermaid fences', () => {
    const text = 'δl ngoài sơ đồ \\(x\\)\n```mermaid\nflowchart LR\nδl\nA["δl"] --> B\n```\n```text\nδl\n```';
    expect(formatAnswerForClient(text)).toBe(
      'δl ngoài sơ đồ $x$\n```mermaid\nflowchart LR\n\nA["δ<sub>l</sub>"] --> B\n```\n```text\nδl\n```',
    );
  });

  it('leaves a clean mermaid block and its math-looking content alone', () => {
    const text = '```mermaid\nflowchart LR\n  A["\\(x\\)"] --> B[$y$]\n```';
    expect(formatAnswerForClient(text)).toBe(text);
  });
});

describe('sanitizeMermaidGlyphs (PDF path)', () => {
  it('keeps the historical behaviour', () => {
    expect(sanitizeMermaidGlyphs('```mermaid\nA --> B\nδl\nℓv\n\n\nC\n```')).toBe('```mermaid\nA --> B\n\nC\n```');
  });
});
