import { QuestionKind } from '../enums/questionSplit.enums';

/**
 * Named question markers at the start of a line (12/11 plan 08 §2): "Câu 1.", "**Câu 2:**", "Question 3)", "Q4 -",
 * "Bài 5", "Part 2". Group 1 = family word, group 2 = number (optionally with a letter: "1a").
 */
export const NAMED_QUESTION_MARKER = /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?(?:\*\*|__)?[ \t]*(câu|cau|question|bài|bai|part|phần|q)[ \t]*(\d{1,2}[a-z]?)[ \t]*(?:\*\*|__)?[ \t]*(?:[.:)\-–—]|(?=\s))/giu;

/** Numbered list items at the start of a line: "1. …", "2) …". Group 1 = number. */
export const NUMBERED_QUESTION_MARKER = /(?:^|\n)[ \t]*(?:\*\*|__)?(\d{1,2})[ \t]*(?:\*\*|__)?[.)][ \t]+(?=\S)/gu;

/** Lettered sub-questions at the start of a line: "a) …", "b. …". Group 1 = letter. */
export const LETTERED_QUESTION_MARKER = /(?:^|\n)[ \t]*(?:\*\*|__)?([a-h])[ \t]*(?:\*\*|__)?[.)][ \t]+(?=\S)/gu;

/** A question mark ending a sentence (fallback split when no marker is found). */
export const QUESTION_MARK_SPLIT = /(?<=[?？])\s+/u;

/** "(2 điểm)", "(1,5đ)", "(3 points)" in a question (same pattern as Essay Mode). */
export const QUESTION_POINTS_PATTERN = /\(\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|diem|đ|pts?|points?|marks?)\s*\)/iu;

/** Points beyond this are treated as a typo (1–10 is the usual exam scale). */
export const MAX_QUESTION_POINTS = 20;

/** A list item / sentence counts as a question only with at least this many words. */
export const MIN_QUESTION_WORDS = 3;

/** At most this many questions are planned; the rest stay in the last one. */
export const MAX_PLANNED_QUESTIONS = 30;

/** Vietnamese letters with diacritics: the label family follows the question's language ("Câu" vs "Question"). */
export const VIETNAMESE_CHARS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;

export const LABEL_FAMILY_VI = 'Câu';

export const LABEL_FAMILY_EN = 'Question';

/** Words that make a numbered/lettered list item an actual question (exam verbs, interrogatives). */
export const QUESTION_CUE = /[?？]|\b(?:what|why|how|which|when|where|who|explain|describe|discuss|analy[sz]e|compare|contrast|evaluate|define|list|state|draw|calculate|compute|design|propose|justify|identify|outline)\b|(?:^|[\s(,.;:"'])(?:trình bày|giải thích|phân tích|so sánh|phân biệt|đánh giá|bình luận|thảo luận|nêu|liệt kê|kể tên|định nghĩa|là gì|tại sao|vì sao|như thế nào|thế nào|bao nhiêu|vẽ|tính|thiết kế|đề xuất|chứng minh|mô tả|cho biết|hãy)(?=[\s,.;:?)]|$)/iu;

/** Kind of a question, checked in this order (first match wins); no match = SHORT. */
export const QUESTION_KIND_PATTERNS: readonly (readonly [QuestionKind, RegExp])[] = [
  // Only a drawing verb makes a diagram question ("Giải thích mô hình C4" is an essay).
  [QuestionKind.DIAGRAM, /\b(?:draw|sketch)\b|(?:^|[\s(,.;:"'])(?:vẽ|phác thảo)(?=[\s,.;:?)]|$)/iu],
  [QuestionKind.CALC, /\b(?:calculate|compute|solve|how many|how much)\b|(?:^|[\s(,.;:"'])(?:tính|giải phương trình|bao nhiêu)(?=[\s,.;:?)]|$)|\d+\s*[+\-*/×÷^=]\s*\d+/iu],
  [QuestionKind.ESSAY, /\b(?:explain|describe|discuss|analy[sz]e|compare|contrast|evaluate|assess|critique|justify|why|elaborate|present)\b|(?:^|[\s(,.;:"'])(?:trình bày|giải thích|phân tích|so sánh|phân biệt|đánh giá|bình luận|thảo luận|tại sao|vì sao|mô tả|chứng minh|làm rõ)(?=[\s,.;:?)]|$)/iu],
];

/** A question this long is treated as an essay even without an exam verb. */
export const ESSAY_MIN_QUESTION_WORDS = 25;

export const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

/** Longest overlap looked for when a continuation repeats the end of the cut answer (08 §2 "200 ký tự cuối"). */
export const CONTINUATION_OVERLAP_MAX_CHARS = 200;

/** Shorter matches are coincidences ("the ", ", "), not a repeated tail. */
export const CONTINUATION_OVERLAP_MIN_CHARS = 12;
