import {
  CONTINUATION_OVERLAP_MAX_CHARS,
  CONTINUATION_OVERLAP_MIN_CHARS,
  ESSAY_MIN_QUESTION_WORDS,
  LABEL_FAMILY_EN,
  LABEL_FAMILY_VI,
  LETTERED_QUESTION_MARKER,
  MAX_PLANNED_QUESTIONS,
  MAX_QUESTION_POINTS,
  MIN_QUESTION_WORDS,
  NAMED_QUESTION_MARKER,
  NUMBERED_QUESTION_MARKER,
  QUESTION_CUE,
  QUESTION_KIND_PATTERNS,
  QUESTION_MARK_SPLIT,
  QUESTION_POINTS_PATTERN,
  VIETNAMESE_CHARS,
  WORD_PATTERN,
} from '../constants/questionSplit.constants';
import { QuestionKind, QuestionMarker } from '../enums/questionSplit.enums';
import type { QuestionSplit, SplitQuestion } from '../interfaces/questionSplit.interface';

interface MarkerHit {
  index: number;
  end: number;
  family?: string;
  number: string;
}

/** Words in a text (letters/digits runs), same rule as the essay word count. */
export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

/** Marks stated in a question: "(2 điểm)" → 2; undefined when absent or out of range. */
export function questionPoints(text: string): number | undefined {
  const match = QUESTION_POINTS_PATTERN.exec(text);
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= MAX_QUESTION_POINTS ? value : undefined;
}

/** Every "(N điểm)" of a text, in order (08 Bước 4: Essay Mode used only the first one). */
export function allQuestionPoints(text: string): number[] {
  const global = new RegExp(QUESTION_POINTS_PATTERN.source, `${QUESTION_POINTS_PATTERN.flags}g`);
  return [...text.matchAll(global)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= MAX_QUESTION_POINTS);
}

/** Essay / calc / diagram / short (first matching pattern; long questions and questions with marks are essays). */
export function classifyQuestion(text: string): QuestionKind {
  for (const [kind, pattern] of QUESTION_KIND_PATTERNS) if (pattern.test(text)) return kind;
  return questionPoints(text) !== undefined || countWords(text) >= ESSAY_MIN_QUESTION_WORDS ? QuestionKind.ESSAY : QuestionKind.SHORT;
}

function hits(text: string, pattern: RegExp, named: boolean): MarkerHit[] {
  return [...text.matchAll(pattern)].map((match) => ({
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    ...(named ? { family: match[1] } : {}),
    number: named ? match[2] : match[1],
  }));
}

function capitalize(word: string): string {
  return word.length <= 1 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1).toLowerCase();
}

function familyFor(text: string): string {
  return VIETNAMESE_CHARS.test(text) ? LABEL_FAMILY_VI : LABEL_FAMILY_EN;
}

function build(text: string, found: MarkerHit[], marker: QuestionMarker, family: string): QuestionSplit {
  const capped = found.slice(0, MAX_PLANNED_QUESTIONS);
  const questions = capped.map((hit, i): SplitQuestion => {
    const next = i + 1 < capped.length ? capped[i + 1].index : text.length;
    const body = text.slice(hit.end, next).trim();
    const label = marker === QuestionMarker.LETTERED ? `${hit.number})` : `${hit.family ? capitalize(hit.family) : family} ${hit.number}`;
    const points = questionPoints(body);
    return { id: `Q${i + 1}`, label, number: hit.number, text: body, kind: classifyQuestion(body), ...(points !== undefined ? { points } : {}) };
  });
  return { preamble: text.slice(0, capped[0].index).trim(), questions, marker };
}

/** List items are questions only when every item asks something (a numbered list of requirements is not). */
function allAsk(text: string, found: MarkerHit[]): boolean {
  return found.every((hit, i) => {
    const body = text.slice(hit.end, i + 1 < found.length ? found[i + 1].index : text.length);
    return countWords(body) >= MIN_QUESTION_WORDS && QUESTION_CUE.test(body);
  });
}

function single(text: string, family: string): QuestionSplit {
  const body = text.trim();
  const points = questionPoints(body);
  return {
    preamble: '',
    questions: [{ id: 'Q1', label: `${family} 1`, number: '1', text: body, kind: classifyQuestion(body), ...(points !== undefined ? { points } : {}) }],
    marker: QuestionMarker.NONE,
  };
}

/** Fallback: several sentences ending in "?" — each one a question; text before the first stays the preamble. */
function byQuestionMarks(text: string, family: string): QuestionSplit | null {
  const sentences = text.split(QUESTION_MARK_SPLIT).map((part) => part.trim()).filter(Boolean);
  const asking = sentences.filter((sentence) => /[?？]$/u.test(sentence) && countWords(sentence) >= MIN_QUESTION_WORDS);
  if (asking.length < 2) return null;
  const questions: string[] = [];
  const preamble: string[] = [];
  for (const sentence of sentences) {
    if (/[?？]$/u.test(sentence) && countWords(sentence) >= MIN_QUESTION_WORDS) questions.push(sentence);
    else if (questions.length === 0) preamble.push(sentence);
    else questions[questions.length - 1] += ` ${sentence}`;
  }
  return {
    preamble: preamble.join(' '),
    questions: questions.slice(0, MAX_PLANNED_QUESTIONS).map((body, i) => {
      const points = questionPoints(body);
      return { id: `Q${i + 1}`, label: `${family} ${i + 1}`, number: String(i + 1), text: body, kind: classifyQuestion(body), ...(points !== undefined ? { points } : {}) };
    }),
    marker: QuestionMarker.QUESTION_MARK,
  };
}

/**
 * Splits a prompt into its questions (12/11 plan 08 §2, rule-based, no model call): named markers ("Câu 1",
 * "Question 2", "Q3", "Bài 4") first, then numbered ("1.") or lettered ("a)") list items that each ask something,
 * then several "?" sentences. Never empty: a prompt without markers is one question.
 */
export function splitQuestions(text: string): QuestionSplit {
  const family = familyFor(text);
  const named = hits(text, NAMED_QUESTION_MARKER, true);
  if (named.length >= 2) return build(text, named, QuestionMarker.NAMED, family);
  const numbered = hits(text, NUMBERED_QUESTION_MARKER, false);
  if (numbered.length >= 2 && allAsk(text, numbered)) return build(text, numbered, QuestionMarker.NUMBERED, family);
  const lettered = hits(text, LETTERED_QUESTION_MARKER, false);
  if (lettered.length >= 2 && allAsk(text, lettered)) return build(text, lettered, QuestionMarker.LETTERED, family);
  return byQuestionMarks(text, family) ?? single(text, family);
}

/**
 * Joins an auto-continuation to the cut text (08 §2): when the continuation starts by repeating the end of the
 * cut text (up to 200 characters), the repeated part is dropped. Returns only the text to append.
 */
export function continuationTail(previous: string, next: string): string {
  const max = Math.min(CONTINUATION_OVERLAP_MAX_CHARS, previous.length, next.length);
  for (let length = max; length >= CONTINUATION_OVERLAP_MIN_CHARS; length--) {
    if (previous.endsWith(next.slice(0, length))) return next.slice(length);
  }
  // A continuation that restarts the last (unfinished) line from its beginning: keep only what is new.
  const lastLine = previous.slice(previous.lastIndexOf('\n') + 1);
  if (lastLine.trim().length >= CONTINUATION_OVERLAP_MIN_CHARS && next.trimStart().startsWith(lastLine.trimStart())) {
    return next.trimStart().slice(lastLine.trimStart().length);
  }
  return next;
}
