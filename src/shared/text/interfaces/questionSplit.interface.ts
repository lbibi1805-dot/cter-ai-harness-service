import type { QuestionKind, QuestionMarker } from '../enums/questionSplit.enums';

/** One question found in a prompt. */
export interface SplitQuestion {
  /** Stable id, `Q1`, `Q2`… in order. */
  id: string;
  /** Label the answer must start with: the exam's own numbering ("Câu 3", "Question 2a", "a)") or "Câu i". */
  label: string;
  /** The number/letter as written ("3", "2a", "b"); used to find the label in the answer. */
  number: string;
  /** The question text (marker removed). */
  text: string;
  kind: QuestionKind;
  /** Marks stated in this question ("(2 điểm)" → 2). */
  points?: number;
}

/** `splitQuestions` result. */
export interface QuestionSplit {
  /** Shared statement before the first question (case study, instructions); '' when none. */
  preamble: string;
  questions: SplitQuestion[];
  marker: QuestionMarker;
}
