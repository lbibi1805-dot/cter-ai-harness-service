import { describe, it, expect } from 'vitest';
import { parseLinkRel } from './linkHeader';

/**
 * Characterization tests for core/linkHeader.ts — table-driven over real Canvas API
 * Link header shapes, per PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 0 step 4 / FIX #13.
 *
 * The two reference implementations below are verbatim copies of the current
 * (unexported) private helpers in `canvasClient.ts` and `conversationClient.ts` — kept
 * here only to lock in their exact current behavior before any later phase merges them
 * into the shared `core/linkHeader.parseLinkRel`. Do not import from the real modules:
 * these functions are intentionally not exported (internal to their files).
 */
function referenceParseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, relPart] = part.split(';');
    if (relPart?.trim() === 'rel="next"') {
      const match = urlPart.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }
  return null;
}

function referenceParseLinkRel(linkHeader: string | null, rel: string): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, ...params] = part.split(';');
    if (params.some(p => p.trim() === `rel="${rel}"`)) {
      const match = urlPart.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }
  return null;
}

// Real-shaped Canvas API pagination Link headers (see Canvas LMS REST API pagination docs).
const CANVAS_LINK_HEADERS: { name: string; header: string | null }[] = [
  { name: 'null header', header: null },
  { name: 'empty string', header: '' },
  {
    name: 'typical 4-rel canvas header',
    header: '<https://canvas.example.com/api/v1/courses?page=1>; rel="current",' +
      '<https://canvas.example.com/api/v1/courses?page=2>; rel="next",' +
      '<https://canvas.example.com/api/v1/courses?page=1>; rel="first",' +
      '<https://canvas.example.com/api/v1/courses?page=5>; rel="last"',
  },
  {
    name: 'no next rel (last page)',
    header: '<https://canvas.example.com/api/v1/courses?page=5>; rel="current",' +
      '<https://canvas.example.com/api/v1/courses?page=1>; rel="first",' +
      '<https://canvas.example.com/api/v1/courses?page=5>; rel="last"',
  },
  {
    name: 'single rel, no leading current',
    header: '<https://canvas.example.com/api/v1/conversations?page=3>; rel="next"',
  },
];

describe('core/linkHeader parseLinkRel — parity with existing parseLinkNext/parseLinkRel for real Canvas headers', () => {
  it.each(CANVAS_LINK_HEADERS)('matches parseLinkNext for rel=next — $name', ({ header }) => {
    expect(parseLinkRel(header, 'next')).toBe(referenceParseLinkNext(header));
  });

  it.each(CANVAS_LINK_HEADERS)('matches parseLinkRel for rel=next — $name', ({ header }) => {
    expect(parseLinkRel(header, 'next')).toBe(referenceParseLinkRel(header, 'next'));
  });

  it('supports arbitrary rel values like the original parseLinkRel (parseLinkNext cannot)', () => {
    const header = '<https://canvas.example.com/api/v1/courses?page=1>; rel="first"';
    expect(parseLinkRel(header, 'first')).toBe('https://canvas.example.com/api/v1/courses?page=1');
    expect(parseLinkRel(header, 'next')).toBeNull();
  });

  // Documents the known divergence (FIX #13): parseLinkNext only ever inspects the
  // 2nd `;`-segment, so a rel param NOT in that exact position is missed, while
  // parseLinkRel (and this core implementation) scans every param.
  it('diverges from parseLinkNext when rel="next" is not the first param after the URL', () => {
    const header = '<https://canvas.example.com/api/v1/courses?page=2>; foo="bar"; rel="next"';
    expect(referenceParseLinkNext(header)).toBeNull();
    expect(referenceParseLinkRel(header, 'next')).toBe('https://canvas.example.com/api/v1/courses?page=2');
    expect(parseLinkRel(header, 'next')).toBe('https://canvas.example.com/api/v1/courses?page=2');
  });
});
