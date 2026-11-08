import {
  AUTO_DETECT_MIN_CHARS,
  DECIMAL_COMMA,
  DECIMAL_POINT,
  ESSAY_COMMAND,
  ESSAY_POINTS_FLAG,
  ESSAY_STRICT_FLAG,
  ESSAY_VERB_PATTERNS,
  MAX_ESSAY_POINTS,
  QUESTION_POINTS,
  WHITESPACE,
} from '../constants/essay.constants';
import type { EssayVerb } from '../enums/essay.enums';
import type { ParsedEssayCommand } from '../interfaces/essay.interface';

function toPoints(raw: string): number | undefined {
  const value = Number(raw.replace(DECIMAL_COMMA, DECIMAL_POINT));
  return Number.isFinite(value) && value > 0 && value <= MAX_ESSAY_POINTS ? value : undefined;
}

/**
 * `/essay [strict] [3đ] <question>` → flags + question; null when the text is not an `/essay` command.
 * Flags may come in any order, before the question only.
 */
export function parseEssayCommand(text: string): ParsedEssayCommand | null {
  const match = ESSAY_COMMAND.exec(text);
  if (!match) return null;
  const words = text.slice(match[0].length).trim().split(WHITESPACE).filter(Boolean);
  let strict = false;
  let points: number | undefined;
  let consumed = 0;
  for (const word of words) {
    if (ESSAY_STRICT_FLAG.test(word)) strict = true;
    else if (ESSAY_POINTS_FLAG.test(word) && points === undefined) points = toPoints(ESSAY_POINTS_FLAG.exec(word)![1]);
    else break;
    consumed++;
  }
  // Keep the question's own line breaks: cut the flags off the original text, not the split words.
  let rest = text.slice(match[0].length).trimStart();
  for (let i = 0; i < consumed; i++) rest = rest.slice(words[i].length).trimStart();
  return { question: rest.trim(), strict, ...(points !== undefined ? { points } : {}) };
}

/** Points stated in the question: "(2 điểm)" → 2. */
export function extractQuestionPoints(question: string): number | undefined {
  const match = QUESTION_POINTS.exec(question);
  return match ? toPoints(match[1]) : undefined;
}

/** Exam verbs found in the question, in table order. */
export function detectVerbs(question: string): EssayVerb[] {
  const lower = question.toLowerCase();
  return (Object.entries(ESSAY_VERB_PATTERNS) as [EssayVerb, RegExp][])
    .filter(([, pattern]) => pattern.test(lower))
    .map(([verb]) => verb);
}

/**
 * Conservative automatic trigger (ESSAY_MODE_ENABLED): the question states its marks ("(2 điểm)") AND uses
 * an exam verb AND is long enough. A plain question with a verb only stays in normal mode.
 */
export function detectEssayQuestion(question: string): boolean {
  if (question.trim().length < AUTO_DETECT_MIN_CHARS) return false;
  return extractQuestionPoints(question) !== undefined && detectVerbs(question).length > 0;
}
