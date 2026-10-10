import type { GoldenItem } from '../../rag/domain';
import { REFUSAL_PATTERN } from './answerEval.enums';
import type { JudgeVerdict, LatencyStats, SampleScores } from './answerEval.types';

const RELEVANCE_MAX = 5;
/** "## References", "References:", "**References**", "**References:**". */
const REFERENCES_HEADING = /^#{1,6}\s*references\b|^\*{0,2}references:?\*{0,2}:?\s*$/i;
const ANY_HEADING = /^#{1,6}\s+/;
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const MARKDOWN_LINK_TARGET = /\[[^\]]*\]\(([^)]+)\)/g;
/** Vault file names contain spaces ("Chapter 1 - Testing Fundamentals.md"), so a path runs up to ".md". */
const MARKDOWN_PATH = /[^,;`'"()<>[\]|*]+?\.md\b/gi;

/** Nearest-rank percentile (p in 0..100). */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1];
}

export function latencyStats(values: number[]): LatencyStats | null {
  if (values.length === 0) return null;
  return {
    mean: values.reduce((s, v) => s + v, 0) / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
  };
}

export function meanOf(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return present.length === 0 ? null : present.reduce((s, v) => s + v, 0) / present.length;
}

/** Vault file paths listed in the answer's "References" section. */
export function parseCitedSources(answer: string): string[] {
  const lines = answer.split(/\r?\n/);
  const start = lines.findIndex((line) => REFERENCES_HEADING.test(line.trim()));
  if (start === -1) return [];
  const cited: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (ANY_HEADING.test(line.trim())) break;
    const item = line.replace(LIST_MARKER, '').replace(MARKDOWN_LINK_TARGET, ' $1 ');
    for (const match of item.match(MARKDOWN_PATH) ?? []) {
      const path = normalizeSourcePath(match);
      if (!cited.includes(path)) cited.push(path);
    }
  }
  return cited;
}

export function normalizeSourcePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
}

/** Citations may be written as a full vault path, a path suffix or just the file name. */
export function sourceMatches(cited: string, expected: string): boolean {
  const a = normalizeSourcePath(cited);
  const b = normalizeSourcePath(expected);
  return a === b || b.endsWith(`/${a}`) || a.endsWith(`/${b}`);
}

export function citationScores(cited: string[], expected: string[]): { precision: number | null; recall: number | null } {
  if (expected.length === 0) return { precision: null, recall: null };
  const correct = cited.filter((c) => expected.some((e) => sourceMatches(c, e)));
  const found = expected.filter((e) => cited.some((c) => sourceMatches(c, e)));
  return {
    precision: cited.length === 0 ? null : correct.length / cited.length,
    recall: found.length / expected.length,
  };
}

export function f1Score(precision: number | null, recall: number | null): number | null {
  if (precision === null || recall === null) return null;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/** Heuristic refusal check used when the judge is unavailable. */
export function looksLikeRefusal(answer: string): boolean {
  return REFUSAL_PATTERN.test(answer);
}

/** Turns the judge's raw facts into scores; never trusts a number the judge made up. */
export function scoreSample(item: GoldenItem, verdict: JudgeVerdict | undefined, citedSources: string[]): SampleScores {
  const citations = citationScores(citedSources, item.expectedSources);
  if (!verdict) {
    return {
      answerPrecision: null, completeness: null, f1: null, relevance: null,
      citationPrecision: citations.precision, citationRecall: citations.recall, refusalCorrect: null,
    };
  }
  const answerPrecision = verdict.claims.length === 0 ? null : verdict.claims.filter((c) => c.supported).length / verdict.claims.length;
  const completeness = item.keyPoints.length === 0 ? null : verdict.keyPointsCovered.filter(Boolean).length / item.keyPoints.length;
  return {
    answerPrecision,
    completeness,
    f1: f1Score(answerPrecision, completeness),
    relevance: verdict.relevance / RELEVANCE_MAX,
    citationPrecision: citations.precision,
    citationRecall: citations.recall,
    refusalCorrect: item.answerable ? !verdict.refused : verdict.refused,
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export function jaccard(a: string[], b: string[]): number | null {
  const left = new Set(a.map(normalizeSourcePath));
  const right = new Set(b.map(normalizeSourcePath));
  if (left.size === 0 && right.size === 0) return null;
  const intersection = [...left].filter((x) => right.has(x)).length;
  return intersection / (left.size + right.size - intersection);
}
