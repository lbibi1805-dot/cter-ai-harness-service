/** `eval:answers`: each essay answer must reach this share of its target words (08 Bước 8: ≥ 80 %). */
export const ANSWER_EVAL_LENGTH_RATIO = 0.8;

/** A paragraph / bullet ends a sentence with one of these (closing quotes, brackets, `$` math and emphasis allowed). */
export const ANSWER_EVAL_SENTENCE_END = /[.!?…:;。)"”'’*_$`\]]\s*$/u;
