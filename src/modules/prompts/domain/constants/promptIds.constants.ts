import { PromptPath } from '../enums/prompt.enums';

/** Ids the code composes by name (12/11 02): every instruction the model reads comes from one of these files. */
export const PromptId = {
  PRECEDENCE: 'policy.precedence',
  REMINDER: 'policy.reminder',
  DIAGRAM_SYNTAX: 'policy.diagram-syntax',
  RESEARCH_MODE: 'skill.agent.research-mode',
  ESSAY_WRITER: 'skill.essay.writer',
  C4_SYSTEM: 'skill.c4.system',
  C4_DOMAIN: 'domain.system-architecture',
} as const;

/** Paths whose composition `GET /api/prompts` reports (`compositions`). */
export const COMPOSED_PATHS: readonly PromptPath[] = [PromptPath.SINGLE, PromptPath.AGENT, PromptPath.ESSAY, PromptPath.C4];
