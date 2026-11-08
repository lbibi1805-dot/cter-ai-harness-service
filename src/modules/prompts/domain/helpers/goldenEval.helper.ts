import {
  FORBIDDEN_PENALTY,
  MISSING_CITATION_PENALTY,
  PASS_COVERAGE,
  POINT_ALTERNATIVE_SEPARATOR,
  REFERENCES_HEADING,
  REFERENCES_PENALTY,
} from '../constants/goldenEval.constants';
import type { GoldenAnswer, GoldenCase, GoldenScore } from '../interfaces/goldenEval.interface';

function contains(haystack: string, needle: string): boolean {
  return haystack.includes(needle.trim().toLowerCase());
}

/** Rule-based score of one golden case: expected-point coverage, no References section, nothing forbidden, citations present. */
export function scoreGoldenCase(testCase: GoldenCase, answer: GoldenAnswer): GoldenScore {
  const text = answer.text.toLowerCase();
  const missingPoints = testCase.expected_points.filter((point) =>
    !point.split(POINT_ALTERNATIVE_SEPARATOR).some((alternative) => alternative.trim() && contains(text, alternative)));
  const coverage = testCase.expected_points.length ? 1 - missingPoints.length / testCase.expected_points.length : 1;
  const hasReferencesSection = REFERENCES_HEADING.test(answer.text);
  const forbiddenHits = (testCase.forbidden ?? []).filter((item) => item.trim() && contains(text, item));
  const files = (answer.sources ?? []).map((source) => source.file.toLowerCase());
  const missingCitations = (testCase.must_cite ?? []).filter((prefix) => !files.some((file) => file.startsWith(prefix.toLowerCase())));

  let score = coverage;
  if (hasReferencesSection) score *= REFERENCES_PENALTY;
  if (forbiddenHits.length) score *= FORBIDDEN_PENALTY;
  if (missingCitations.length) score *= MISSING_CITATION_PENALTY;
  return {
    id: testCase.id,
    coverage,
    missingPoints,
    hasReferencesSection,
    forbiddenHits,
    missingCitations,
    score,
    pass: coverage >= PASS_COVERAGE && !hasReferencesSection && !forbiddenHits.length && !missingCitations.length,
  };
}

/** Mean of `values` (0 for an empty list). */
export function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
