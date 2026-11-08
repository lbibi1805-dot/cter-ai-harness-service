import {
  ASPECT_CONJUNCTION,
  ASPECT_MIN_WORDS,
  ASPECT_SEPARATORS,
  DEFAULT_TARGET_WORDS,
  JSON_OBJECT,
  MAX_ESSAY_ASPECTS,
  MAX_ESSAY_OUTPUT_TOKENS,
  MAX_ESSAY_POINTS,
  MAX_TARGET_WORDS,
  MIN_TARGET_WORDS,
  OUTLINE_TOKENS,
  QUESTION_POINTS,
  SUBJECT_MAX_CHARS,
  THINKING_TOKENS,
  TOKENS_PER_WORD,
  WHITESPACE,
} from '../constants/essay.constants';
import { EssayVerb } from '../enums/essay.enums';
import type { EssayAnalysis } from '../interfaces/essay.interface';
import { detectVerbs, extractQuestionPoints } from './essayCommand.helper';

function wordCountOf(text: string): number {
  return text.trim().split(WHITESPACE).filter(Boolean).length;
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fallback for step ①: split the question on list separators, then on "và"/"and" when both halves are
 * long enough to be separate asks ("So sánh black-box và white-box" stays one aspect). Never empty.
 */
export function heuristicAnalysis(question: string): EssayAnalysis {
  const text = question.replace(QUESTION_POINTS, ' ').trim();
  const parts = text
    .split(ASPECT_SEPARATORS)
    .flatMap((part) => {
      const halves = part.split(ASPECT_CONJUNCTION);
      return halves.length > 1 && halves.every((half) => wordCountOf(half) >= ASPECT_MIN_WORDS) ? halves : [part];
    })
    .map((part) => part.trim())
    .filter((part) => wordCountOf(part) > 0);
  const aspects = dedupe(parts).slice(0, MAX_ESSAY_ASPECTS);
  const points = extractQuestionPoints(question);
  return {
    subject: text.slice(0, SUBJECT_MAX_CHARS),
    aspects: aspects.length > 1 ? aspects : [text || question.trim()],
    verbs: detectVerbs(question),
    ...(points !== undefined ? { points } : {}),
    fromModel: false,
  };
}

function positiveNumber(value: unknown, max: number): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max ? value : undefined;
}

/** The aux model's JSON (possibly fenced or wrapped in prose); null when unusable → heuristic. */
export function parseAnalysisReply(raw: string, question: string): EssayAnalysis | null {
  const json = JSON_OBJECT.exec(raw);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json[0]);
  } catch {
    return null;
  }
  return parseAnalysisObject(parsed, question);
}

/** An already-parsed analysis object (the `essay` block of the shared router answer); null when unusable → heuristic. */
export function parseAnalysisObject(value: unknown, question: string): EssayAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  const aspects = Array.isArray(parsed.aspects)
    ? dedupe(parsed.aspects.filter((a): a is string => typeof a === 'string').map((a) => a.trim()).filter(Boolean)).slice(0, MAX_ESSAY_ASPECTS)
    : [];
  if (aspects.length === 0) return null;
  const known = new Set<string>(Object.values(EssayVerb));
  const verbs = Array.isArray(parsed.verbs)
    ? [...new Set(parsed.verbs.filter((v): v is EssayVerb => typeof v === 'string' && known.has(v.toLowerCase())).map((v) => v.toLowerCase() as EssayVerb))]
    : [];
  const points = positiveNumber(parsed.points, MAX_ESSAY_POINTS) ?? extractQuestionPoints(question);
  const targetWords = positiveNumber(parsed.targetWords, MAX_TARGET_WORDS);
  return {
    subject: typeof parsed.subject === 'string' ? parsed.subject.trim().slice(0, SUBJECT_MAX_CHARS) : '',
    aspects,
    verbs: verbs.length ? verbs : detectVerbs(question),
    ...(points !== undefined ? { points } : {}),
    ...(targetWords !== undefined ? { targetWords: Math.round(targetWords) } : {}),
    fromModel: true,
  };
}

/** Words to write: points × ESSAY_WORDS_PER_POINT (15 §4.2), else a stated length, else the default; clamped. */
export function targetWordsFor(points: number | undefined, statedWords: number | undefined, wordsPerPoint: number): number {
  const raw = points !== undefined ? points * wordsPerPoint : statedWords ?? DEFAULT_TARGET_WORDS;
  return Math.min(MAX_TARGET_WORDS, Math.max(MIN_TARGET_WORDS, Math.round(raw)));
}

/** maxOutputTokens for the outline + essay call: sized to the target, never above the essay cap. */
export function essayOutputTokens(targetWords: number): number {
  return Math.min(MAX_ESSAY_OUTPUT_TOKENS, Math.ceil(targetWords * TOKENS_PER_WORD) + OUTLINE_TOKENS + THINKING_TOKENS);
}
