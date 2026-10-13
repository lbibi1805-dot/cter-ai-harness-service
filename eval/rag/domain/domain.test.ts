import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GoldenFormatError, parseGoldenSet } from './golden';
import { hitAtK, precisionAtK, recallAtK, reciprocalRank, scoreStats, type RankedChunk } from './retrievalMetrics';

const chunk = (source: string, score = 0.5): RankedChunk => ({ source, heading: '', score });
// rank:          1           2           3           4
const RANKED = [chunk('x.md'), chunk('a.md'), chunk('a.md'), chunk('b.md')];

describe('retrieval metrics', () => {
  it('hit@k', () => {
    expect(hitAtK(RANKED, ['a.md'], 1)).toBe(0);
    expect(hitAtK(RANKED, ['a.md'], 2)).toBe(1);
    expect(hitAtK(RANKED, ['zzz.md'], 4)).toBe(0);
  });

  it('precision@k counts relevant chunks, including several from the same file', () => {
    expect(precisionAtK(RANKED, ['a.md'], 3)).toBeCloseTo(2 / 3);
    expect(precisionAtK(RANKED, ['a.md', 'b.md'], 4)).toBe(0.75);
    expect(precisionAtK(RANKED, ['a.md'], 0)).toBe(0);
  });

  it('recall@k counts distinct expected files', () => {
    expect(recallAtK(RANKED, ['a.md', 'b.md'], 3)).toBe(0.5);
    expect(recallAtK(RANKED, ['a.md', 'b.md'], 4)).toBe(1);
    expect(recallAtK(RANKED, [], 4)).toBe(0);
  });

  it('reciprocal rank uses the first relevant chunk', () => {
    expect(reciprocalRank(RANKED, ['a.md'])).toBe(0.5);
    expect(reciprocalRank(RANKED, ['b.md'])).toBe(0.25);
    expect(reciprocalRank(RANKED, ['zzz.md'])).toBe(0);
  });

  it('score stats', () => {
    expect(scoreStats([0.9, 0.1, 0.5, 0.3])).toEqual({ count: 4, min: 0.1, median: 0.4, max: 0.9 });
    expect(scoreStats([])).toBeNull();
  });
});

describe('golden set parsing', () => {
  it('parses JSONL, skipping blank lines and // comments, with answerable defaulting to true', () => {
    const items = parseGoldenSet([
      '// comment',
      '',
      '{"id":"q1","question":"Q?","expected_sources":["a.md"],"key_points":["k"]}',
      '{"id":"q2","question":"Off topic?","answerable":false}',
    ].join('\n'));
    expect(items).toEqual([
      { id: 'q1', question: 'Q?', expectedSources: ['a.md'], keyPoints: ['k'], answerable: true },
      { id: 'q2', question: 'Off topic?', expectedSources: [], keyPoints: [], answerable: false },
    ]);
  });

  it.each([
    ['{"question":"Q?","expected_sources":["a.md"]}', /"id" is required/],
    ['{"id":"q","question":"Q?"}', /needs at least one expected source/],
    ['{"id":"q","question":"Q?","expected_sources":"a.md"}', /must be a string array/],
    ['not json', /not valid JSON/],
  ])('rejects %s', (line, message) => {
    expect(() => parseGoldenSet(line)).toThrow(message);
  });

  it('rejects duplicate ids', () => {
    const line = '{"id":"q","question":"Q?","expected_sources":["a.md"]}';
    expect(() => parseGoldenSet(`${line}\n${line}`)).toThrow(GoldenFormatError);
  });

  it('the committed example set is valid', () => {
    const items = parseGoldenSet(fs.readFileSync(path.resolve(__dirname, '..', 'golden.example.jsonl'), 'utf-8'));
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => !i.answerable)).toBe(true);
  });
});
