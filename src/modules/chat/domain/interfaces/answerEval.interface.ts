/** One line of `evals/golden/multi-question.jsonl` (snake_case as stored). */
export interface AnswerGoldenCase {
  id: string;
  question: string;
  /** Questions the splitter must find. */
  expected_questions: number;
  /** Free-text note of what the case checks. */
  note?: string;
}

/** Rule score of one case (`npm run eval:answers`). */
export interface AnswerGoldenScore {
  id: string;
  expectedQuestions: number;
  plannedQuestions: number;
  /** Answered / planned questions, in [0, 1] (target 1). */
  coverage: number;
  /** Ids of essay answers under 80 % of their target words. */
  shortAnswers: string[];
  truncated: boolean;
  /** Paragraphs / bullets not ending a sentence. */
  incompleteSentences: number;
  words: number;
  pass: boolean;
  /** 0–10 "câu văn đầy đủ" from the optional judge. */
  judge?: number;
}
