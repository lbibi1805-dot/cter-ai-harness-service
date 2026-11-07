import { FENCE_OPEN_PATTERN } from '../constants/codeSegments.constants';
import type { FencedCodeParts } from '../interfaces/text.interface';

/** End of the line starting at or containing `from` (index of its `\n`, or the text length). */
export function lineEnd(text: string, from: number): number {
  const end = text.indexOf('\n', from);
  return end === -1 ? text.length : end;
}

/** True when `text[at]` is `\n` and the next line is empty or whitespace only (a paragraph break). */
export function isBlankLineBreak(text: string, at: number): boolean {
  if (text[at] !== '\n') return false;
  let j = at + 1;
  while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r')) j++;
  return text[j] === '\n';
}

/** End index (exclusive) of the run of `char` starting at `from`. */
export function runEnd(text: string, from: number, char: string): number {
  let j = from;
  while (text[j] === char) j++;
  return j;
}

/**
 * A fenced code block opening at `lineStart`: the parts up to and including the closing
 * fence line (≤3 spaces, the same char, at least as long, nothing else), or to the end of
 * the text when unclosed. Null when the line is not a fence opener (a backtick fence whose
 * info string contains a backtick is not one — CommonMark).
 */
export function matchFencedBlock(text: string, lineStart: number): FencedCodeParts | null {
  FENCE_OPEN_PATTERN.lastIndex = lineStart;
  const opener = FENCE_OPEN_PATTERN.exec(text);
  if (!opener) return null;
  const [, , fence, info] = opener;
  if (fence[0] === '`' && info.includes('`')) return null;

  const openEnd = lineEnd(text, lineStart);
  const bodyStart = Math.min(openEnd + 1, text.length);
  let line = bodyStart;
  while (line < text.length) {
    const end = lineEnd(text, line);
    if (isClosingFence(text.slice(line, end), fence[0], fence.length)) {
      return { open: text.slice(lineStart, bodyStart), info: info.trim(), body: text.slice(bodyStart, line), close: text.slice(line, end) };
    }
    line = end + 1;
  }
  return { open: text.slice(lineStart, bodyStart), info: info.trim(), body: text.slice(bodyStart), close: '' };
}

function isClosingFence(line: string, char: string, minLength: number): boolean {
  let i = 0;
  while (i < 3 && line[i] === ' ') i++;
  const end = runEnd(line, i, char);
  return end - i >= minLength && line.slice(end).trim() === '';
}

/**
 * Start of the next run of exactly `length` backticks at or after `from`, or -1 when
 * a paragraph break (blank line) or the end of the text comes first.
 */
export function findClosingBacktickRun(text: string, from: number, length: number): number {
  let j = from;
  while (j < text.length) {
    if (text[j] === '`') {
      const end = runEnd(text, j, '`');
      if (end - j === length) return j;
      j = end;
      continue;
    }
    if (isBlankLineBreak(text, j)) return -1;
    j++;
  }
  return -1;
}
