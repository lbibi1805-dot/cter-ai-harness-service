import { ANSWER_PROMPT_IDS } from '../../domain/constants/answerPlan.constants';
import type { AnswerPrompts } from '../../domain/interfaces/answerPlan.interface';
import { DEFAULT_ANSWER_PROMPTS } from '../constants/answerPrompts.constants';

/** prompts/skills/answer/*.md from the registry (`skill(id)` → body), each falling back to its built-in copy. */
export function answerPromptsFrom(skill: ((id: string) => string | null) | null): AnswerPrompts {
  const pick = (id: string, fallback: string) => skill?.(id)?.trim() || fallback;
  return {
    plan: pick(ANSWER_PROMPT_IDS.plan, DEFAULT_ANSWER_PROMPTS.plan),
    section: pick(ANSWER_PROMPT_IDS.section, DEFAULT_ANSWER_PROMPTS.section),
    continue: pick(ANSWER_PROMPT_IDS.continue, DEFAULT_ANSWER_PROMPTS.continue),
    coverageFix: pick(ANSWER_PROMPT_IDS.coverageFix, DEFAULT_ANSWER_PROMPTS.coverageFix),
  };
}
