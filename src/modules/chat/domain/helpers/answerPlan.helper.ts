import { QuestionKind, QuestionMarker, countWords, splitQuestions } from '../../../../shared/text';
import {
  ANSWER_SINGLE_CALL_MAX_TOKENS,
  ANSWER_THINKING_RESERVE_TOKENS,
  ANSWER_TOKENS_PER_WORD,
  COVERAGE_MIN_WORD_RATIO,
  PLAN_SHORT_MARK,
  TEMPLATE_PLACEHOLDER,
  UNFORCED_WORDS,
} from '../constants/answerPlan.constants';
import type { AnswerCompletenessSettings, AnswerCoverage, AnswerPlan, PlannedQuestion } from '../interfaces/answerPlan.interface';

/** Label families the answer may use for a numbered question ("Câu 2" asked, "**Question 2.**" written). */
const LABEL_FAMILIES = '(?:câu|cau|question|q|bài|bai|part|phần)';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Target words of a question (08 §2, §6): marks × ESSAY_WORDS_PER_POINT; an essay without marks gets
 * ANSWER_MIN_WORDS_PER_QUESTION; short / calc / diagram questions without marks are not forced.
 */
export function targetWordsOf(kind: QuestionKind, points: number | undefined, settings: Pick<AnswerCompletenessSettings, 'minWordsPerQuestion' | 'wordsPerPoint'>): number | undefined {
  if (points !== undefined) return Math.round(points * settings.wordsPerPoint);
  return kind === QuestionKind.ESSAY ? settings.minWordsPerQuestion : undefined;
}

/** Expected output tokens of a set of planned questions. */
export function estimateTokens(questions: readonly PlannedQuestion[]): number {
  return Math.ceil(questions.reduce((sum, q) => sum + (q.targetWords ?? UNFORCED_WORDS[q.kind]), 0) * ANSWER_TOKENS_PER_WORD);
}

/** The answer plan of a prompt: its questions (rule-based split) with target words and the token estimate. */
export function buildAnswerPlan(question: string, settings: Pick<AnswerCompletenessSettings, 'minWordsPerQuestion' | 'wordsPerPoint'>): AnswerPlan {
  const split = splitQuestions(question);
  const questions = split.questions.map((q): PlannedQuestion => {
    const targetWords = targetWordsOf(q.kind, q.points, settings);
    return { ...q, ...(targetWords !== undefined ? { targetWords } : {}) };
  });
  return { preamble: split.marker === QuestionMarker.NONE ? '' : split.preamble, questions, estimatedTokens: estimateTokens(questions) };
}

/** Tokens one call may write: the output cap minus the thinking reserve, at most ANSWER_SINGLE_CALL_MAX_TOKENS. */
export function singleCallBudget(maxOutputTokens: number): number {
  return Math.min(ANSWER_SINGLE_CALL_MAX_TOKENS, Math.max(1, maxOutputTokens - ANSWER_THINKING_RESERVE_TOKENS));
}

/**
 * Sections of the answer (08 §2): one when the plan fits one call, else consecutive groups of at most
 * `maxPerSection` questions, each group also within the single-call budget (a group is never empty).
 */
export function groupSections(plan: AnswerPlan, settings: Pick<AnswerCompletenessSettings, 'maxOutputTokens' | 'sectionMaxQuestions'>): PlannedQuestion[][] {
  const budget = singleCallBudget(settings.maxOutputTokens);
  if (plan.questions.length <= 1 || plan.estimatedTokens <= budget) return [plan.questions];
  const maxPerSection = Math.max(1, settings.sectionMaxQuestions);
  const groups: PlannedQuestion[][] = [];
  let current: PlannedQuestion[] = [];
  for (const question of plan.questions) {
    const next = [...current, question];
    if (current.length > 0 && (next.length > maxPerSection || estimateTokens(next) > budget)) {
      groups.push(current);
      current = [question];
    } else {
      current = next;
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

/** `{{name}}` placeholders filled from `values`; unknown placeholders are left as they are. */
export function renderTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(TEMPLATE_PLACEHOLDER, (whole, name: string) => (name in values ? String(values[name]) : whole));
}

/** One plan line per question: `- **Câu 2.** — ~350 words — <first words of the question>`. */
export function planLines(questions: readonly PlannedQuestion[]): string {
  return questions.map((q) => `- **${q.label}${q.label.endsWith(')') ? '' : '.'}** — ${q.targetWords ? `~${q.targetWords} words` : PLAN_SHORT_MARK}${q.points !== undefined ? ` (${q.points} pts)` : ''}`).join('\n');
}

/** Labels of questions for the section / fix instructions: "Câu 4 (~300 words), Câu 5 (short)". */
export function labelList(questions: readonly PlannedQuestion[]): string {
  return questions.map((q) => `${q.label} (${q.targetWords ? `~${q.targetWords} words` : PLAN_SHORT_MARK})`).join(', ');
}

function labelPatterns(question: PlannedQuestion): RegExp[] {
  const number = escapeRegExp(question.number);
  const end = '(?![\\p{L}\\p{N}])';
  const lineStart = '(?:^|\\n)[ \\t]*(?:#{1,6}[ \\t]*)?(?:\\*\\*|__)?[ \\t]*';
  if (/^[a-h]$/i.test(question.number)) {
    return [new RegExp(`${lineStart}(?:${LABEL_FAMILIES}[ \\t]*)?${number}[ \\t]*(?:\\*\\*|__)?[.):]`, 'iu')];
  }
  return [
    // "**Câu 2.**", "### Question 2", "Q2:" — a family word before the number.
    new RegExp(`${lineStart}${LABEL_FAMILIES}[ \\t]*${number}${end}`, 'iu'),
    // "**2.**", "2)" at the start of a line.
    new RegExp(`${lineStart}${number}[ \\t]*(?:\\*\\*|__)?[.):]`, 'iu'),
  ];
}

/** Position of a question's label in `text` at or after `from` (-1 when absent). */
function findLabel(text: string, question: PlannedQuestion, from: number): number {
  const rest = text.slice(from);
  for (const pattern of labelPatterns(question)) {
    const match = pattern.exec(rest);
    if (match) return from + match.index;
  }
  return -1;
}

/**
 * Rule-based coverage (08 §2, no model call): each question's label must appear, in order, and the text up to the
 * next found label must reach COVERAGE_MIN_WORD_RATIO of its target words. A one-question plan is always covered
 * (its length is the continuation's job).
 */
export function checkCoverage(text: string, questions: readonly PlannedQuestion[]): AnswerCoverage {
  if (questions.length <= 1) return { missing: [], words: Object.fromEntries(questions.map((q) => [q.id, countWords(text)])) };
  const positions: number[] = [];
  let from = 0;
  for (const question of questions) {
    const at = findLabel(text, question, from);
    positions.push(at);
    if (at >= 0) from = at + 1;
  }
  const words: Record<string, number> = {};
  const missing: string[] = [];
  questions.forEach((question, i) => {
    const at = positions[i];
    if (at < 0) {
      words[question.id] = 0;
      missing.push(question.id);
      return;
    }
    const next = positions.slice(i + 1).find((p) => p > at) ?? text.length;
    const written = countWords(text.slice(at, next));
    words[question.id] = written;
    if (question.targetWords && written < question.targetWords * COVERAGE_MIN_WORD_RATIO) missing.push(question.id);
  });
  return { missing, words };
}
