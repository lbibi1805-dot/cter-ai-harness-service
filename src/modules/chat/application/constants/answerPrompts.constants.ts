import type { AnswerPrompts } from '../../domain/interfaces/answerPlan.interface';

/*
 * Built-in copies of prompts/skills/answer/*.md (used when the prompt registry is off). Kept identical to the files by
 * tests/unit/modules/chat/answerOrchestrator.test.ts: edit the .md, then this copy.
 */
export const ANSWER_PLAN_FALLBACK = `<answer_plan>
The message above has {{total}} questions. Answer ALL of them, in this order, each starting with its label in bold:
{{questions}}
"words" is the target length of that answer; "short" means answer fully but briefly, in complete sentences.
</answer_plan>`;

export const ANSWER_SECTION_FALLBACK = `<answer_section>
This answer is written in {{total}} consecutive parts that the reader sees as ONE answer. This is part {{index}} of {{total}}.
Already written (do not write them again): {{done}}.
Write ONLY these questions now, completely and at their target length: {{labels}}.
Start directly with the first label of this part: no greeting, no introduction, no recap of earlier parts, and no closing remark about the remaining parts.
</answer_section>`;

export const ANSWER_CONTINUE_FALLBACK = `[CONTINUE] Your previous answer (the last assistant message) was cut off by the length limit. Continue it EXACTLY where it stopped, even in the middle of a word or sentence: do not repeat any text already written, do not restart, do not add an introduction or a note about continuing. Keep the same language, format and question labels, and finish every question that is not fully answered yet.`;

export const ANSWER_COVERAGE_FIX_FALLBACK = `[COMPLETE THE ANSWER] Your previous answer (the last assistant message) did not fully answer these questions: {{missing}}.
Write ONLY those answers now, each starting with its label in bold and at its target length. Do not repeat or summarize the questions that are already answered, and do not add an introduction.`;

export const DEFAULT_ANSWER_PROMPTS: Readonly<AnswerPrompts> = {
  plan: ANSWER_PLAN_FALLBACK,
  section: ANSWER_SECTION_FALLBACK,
  continue: ANSWER_CONTINUE_FALLBACK,
  coverageFix: ANSWER_COVERAGE_FIX_FALLBACK,
};
