import { TextSegmentKind } from './enums/text.enums';
import { findClosingBacktickRun, matchFencedBlock, runEnd } from './helpers/codeSegments.helper';
import type { TextSegment } from './interfaces/text.interface';

/**
 * Splits Markdown into prose and code so text rewrites never touch code.
 * - Fenced block: at a line start, ≤3 spaces then 3+ backticks or tildes; runs to a closing
 *   fence line of the same char with at least the same length, or to the end of the text.
 * - Inline code: a run of N backticks up to the next run of exactly N backticks before a
 *   blank line; an unmatched run is ordinary text.
 * Concatenating the segments gives back the input exactly.
 */
export function splitCodeSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let plainStart = 0;
  const pushCode = (segment: TextSegment, start: number): void => {
    if (start > plainStart) segments.push({ kind: TextSegmentKind.TEXT, text: text.slice(plainStart, start) });
    segments.push(segment);
    plainStart = start + segment.text.length;
  };

  let i = 0;
  while (i < text.length) {
    if (i === 0 || text[i - 1] === '\n') {
      const fence = matchFencedBlock(text, i);
      if (fence) {
        pushCode({ kind: TextSegmentKind.FENCED_CODE, text: fence.open + fence.body + fence.close, fence }, i);
        i = plainStart;
        continue;
      }
    }
    if (text[i] === '`') {
      const openEnd = runEnd(text, i, '`');
      const close = findClosingBacktickRun(text, openEnd, openEnd - i);
      if (close !== -1) {
        pushCode({ kind: TextSegmentKind.INLINE_CODE, text: text.slice(i, close + (openEnd - i)) }, i);
        i = plainStart;
        continue;
      }
      i = openEnd;
      continue;
    }
    i++;
  }
  if (plainStart < text.length) segments.push({ kind: TextSegmentKind.TEXT, text: text.slice(plainStart) });
  return segments;
}
