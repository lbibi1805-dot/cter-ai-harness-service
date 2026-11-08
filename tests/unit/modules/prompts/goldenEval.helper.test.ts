import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { mean, scoreGoldenCase, type GoldenCase } from '../../../../src/modules/prompts';

const CASE: GoldenCase = {
  id: 'T03',
  question: 'Race condition and mutex?',
  expected_points: ['race condition', 'pthread_mutex_lock', 'flowchart|graph TD', 'semaphore'],
  must_cite: ['Week-02/'],
  forbidden: ['\\('],
};

describe('scoreGoldenCase', () => {
  it('scores keyword coverage (case-insensitive, `a|b` alternatives)', () => {
    const score = scoreGoldenCase(CASE, {
      text: 'A Race Condition happens...\n```mermaid\ngraph td\n```\npthread_mutex_lock(&m);',
      sources: [{ file: 'week-02/Shared-Data.md' }],
    });
    expect(score).toMatchObject({ coverage: 0.75, missingPoints: ['semaphore'], hasReferencesSection: false, forbiddenHits: [], missingCitations: [], pass: true });
    expect(score.score).toBe(0.75);
  });

  it('penalizes a References section, forbidden text and missing citations', () => {
    const score = scoreGoldenCase(CASE, {
      text: 'race condition \\(x\\) pthread_mutex_lock graph TD semaphore\n\n## References\n- a.md',
      sources: [{ file: 'other/a.md' }],
    });
    expect(score.coverage).toBe(1);
    expect(score.hasReferencesSection).toBe(true);
    expect(score.forbiddenHits).toEqual(['\\(']);
    expect(score.missingCitations).toEqual(['Week-02/']);
    expect(score.pass).toBe(false);
    expect(score.score).toBeCloseTo(0.8 * 0.5 * 0.8);
  });

  it('fails below the coverage threshold', () => {
    expect(scoreGoldenCase(CASE, { text: 'nothing relevant', sources: [{ file: 'Week-02/x.md' }] }).pass).toBe(false);
  });

  it('mean of an empty list is 0', () => {
    expect(mean([])).toBe(0);
    expect(mean([1, 0])).toBe(0.5);
  });

  it('the golden set parses and every case has a question and expected points', () => {
    const lines = fs.readFileSync(path.resolve(__dirname, '../../../../evals/golden/qa.jsonl'), 'utf-8').split(/\r?\n/).filter(Boolean);
    const cases = lines.map((line) => JSON.parse(line) as GoldenCase);
    expect(cases.length).toBeGreaterThanOrEqual(8);
    for (const testCase of cases) {
      expect(testCase.question).toBeTruthy();
      expect(testCase.expected_points.length).toBeGreaterThan(0);
    }
  });
});
