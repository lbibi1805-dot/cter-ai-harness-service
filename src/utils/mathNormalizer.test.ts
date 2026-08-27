import { describe, it, expect } from 'vitest';
import { normalizeMathDelimiters } from './mathNormalizer';

describe('normalizeMathDelimiters', () => {
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
});
