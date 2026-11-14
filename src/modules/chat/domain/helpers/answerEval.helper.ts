import { countWords } from '../../../../shared/text';
import { ANSWER_EVAL_LENGTH_RATIO, ANSWER_EVAL_SENTENCE_END } from '../constants/answerEval.constants';
import type { AnswerCompletenessSettings } from '../interfaces/answerPlan.interface';
import type { AnswerGoldenCase, AnswerGoldenScore } from '../interfaces/answerEval.interface';
import { buildAnswerPlan, checkCoverage } from './answerPlan.helper';

/** Paragraphs / bullets whose last character is not a sentence end ("câu cụt"); code fences and headings are skipped. */
export function incompleteSentences(text: string): number {
  const withoutCode = text.replace(/```[\s\S]*?```/g, '');
  return withoutCode
    .split(/\n\s*\n|\n(?=\s*[-*+]\s|\s*\d+[.)]\s)/)
    .map((block) => block.trim())
    .filter((block) => block && !/^#{1,6}\s/.test(block) && !/^\*\*[^*]+\*\*$/.test(block) && !/^\|/.test(block))
    .filter((block) => !ANSWER_EVAL_SENTENCE_END.test(block)).length;
}

/**
 * `npm run eval:answers` rules (12/11 plan 08 Bước 8): coverage = answered / asked questions (target 100 %), words of
 * each essay answer ≥ 80 % of its target, not truncated, no incomplete sentences. The judge score is added by the script.
 */
export function scoreAnswerCase(
  testCase: AnswerGoldenCase,
  text: string,
  truncated: boolean,
  settings: Pick<AnswerCompletenessSettings, 'minWordsPerQuestion' | 'wordsPerPoint'>,
): AnswerGoldenScore {
  const plan = buildAnswerPlan(testCase.question, settings);
  const coverage = checkCoverage(text, plan.questions);
  const planned = plan.questions.length;
  const answered = planned <= 1 ? (countWords(text) > 0 ? 1 : 0) : plan.questions.filter((q) => coverage.words[q.id] > 0).length;
  const short = plan.questions.filter((q) => q.targetWords && (coverage.words[q.id] ?? 0) < q.targetWords * ANSWER_EVAL_LENGTH_RATIO).map((q) => q.id);
  const incomplete = incompleteSentences(text);
  const coverageRate = planned ? answered / planned : 0;
  return {
    id: testCase.id,
    expectedQuestions: testCase.expected_questions,
    plannedQuestions: planned,
    coverage: coverageRate,
    shortAnswers: short,
    truncated,
    incompleteSentences: incomplete,
    words: countWords(text),
    pass: planned === testCase.expected_questions && coverageRate === 1 && short.length === 0 && !truncated && incomplete === 0,
  };
}
