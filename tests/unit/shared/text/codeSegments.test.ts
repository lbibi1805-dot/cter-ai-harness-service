import { describe, it, expect } from 'vitest';
import { TextSegmentKind, splitCodeSegments } from '../../../../src/shared/text';

const kinds = (text: string) => splitCodeSegments(text).map((s) => [s.kind, s.text]);

describe('splitCodeSegments', () => {
  it('round-trips the input exactly', () => {
    const text = 'a `b` c\n```js\nx\n```\nd ``e`` ~~~\n~~~\nf\n~~~';
    expect(splitCodeSegments(text).map((s) => s.text).join('')).toBe(text);
  });

  it('splits fenced blocks with their parts and info string', () => {
    const [before, fence, after] = splitCodeSegments('x\n```Mermaid  extra\nA-->B\n```\ny');
    expect(before).toEqual({ kind: TextSegmentKind.TEXT, text: 'x\n' });
    expect(fence.kind).toBe(TextSegmentKind.FENCED_CODE);
    expect(fence.fence).toEqual({ open: '```Mermaid  extra\n', info: 'Mermaid  extra', body: 'A-->B\n', close: '```' });
    expect(after).toEqual({ kind: TextSegmentKind.TEXT, text: '\ny' });
  });

  it('does not treat a 4-space indented fence as a fence', () => {
    expect(kinds('    ```\n`a`')).toEqual([[TextSegmentKind.TEXT, '    ```\n'], [TextSegmentKind.INLINE_CODE, '`a`']]);
  });

  it('runs an unclosed fence to the end of the text', () => {
    const [fence] = splitCodeSegments('~~~\nx\n```');
    expect(fence.fence).toMatchObject({ body: 'x\n```', close: '' });
  });

  it('matches inline code by exact backtick run length', () => {
    expect(kinds('a ``x ` y`` b')).toEqual([
      [TextSegmentKind.TEXT, 'a '],
      [TextSegmentKind.INLINE_CODE, '``x ` y``'],
      [TextSegmentKind.TEXT, ' b'],
    ]);
  });
});
