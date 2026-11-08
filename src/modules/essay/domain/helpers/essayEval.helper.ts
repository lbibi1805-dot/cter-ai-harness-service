import {
  ESSAY_EVAL_LENGTH_TOLERANCE,
  ESSAY_EVAL_PASS_SCORE,
  ESSAY_EVAL_TERM_ALTERNATIVES,
  ESSAY_EVAL_WEIGHTS,
} from '../constants/essay.constants';
import type { EssayGoldenAnswer, EssayGoldenCase, EssayGoldenScore } from '../interfaces/essay.interface';
import { checkCitations, countWords } from './essayOutput.helper';

/** Rule checks of one golden essay (15 §5): must_terms, length vs target, valid citation ids, coverage, sources. */
export function scoreEssayCase(testCase: EssayGoldenCase, answer: EssayGoldenAnswer): EssayGoldenScore {
  const text = answer.text.toLowerCase();
  const missingTerms = testCase.must_terms.filter((term) =>
    !term.split(ESSAY_EVAL_TERM_ALTERNATIVES).some((alternative) => alternative.trim() && text.includes(alternative.trim().toLowerCase())));
  const termShare = testCase.must_terms.length ? 1 - missingTerms.length / testCase.must_terms.length : 1;

  const wordCount = countWords(answer.text);
  const lengthOk = Math.abs(wordCount - testCase.target_words) <= testCase.target_words * ESSAY_EVAL_LENGTH_TOLERANCE;

  const contextIds = new Set((answer.trace?.contexts ?? []).map((chunk) => chunk.chunkId));
  const outline = answer.essay?.outline ?? '';
  const citations = checkCitations(outline, contextIds);
  const citationsValid = !!answer.essay && answer.essay.droppedCitations === 0 && (contextIds.size === 0 || citations.unknown.length === 0);

  const files = (answer.sources ?? []).map((source) => source.file.toLowerCase());
  const missingCitations = (testCase.must_cite ?? []).filter((prefix) => !files.some((file) => file.startsWith(prefix.toLowerCase())));
  const coverage = answer.essay?.coverage ?? 0;

  const score = ESSAY_EVAL_WEIGHTS.terms * termShare
    + ESSAY_EVAL_WEIGHTS.length * (lengthOk ? 1 : 0)
    + ESSAY_EVAL_WEIGHTS.citations * (citationsValid ? 1 : 0)
    + ESSAY_EVAL_WEIGHTS.coverage * coverage;
  return {
    id: testCase.id,
    missingTerms,
    wordCount,
    targetWords: testCase.target_words,
    lengthOk,
    citationsValid,
    coverage,
    missingCitations,
    score,
    pass: score >= ESSAY_EVAL_PASS_SCORE && missingCitations.length === 0,
  };
}
