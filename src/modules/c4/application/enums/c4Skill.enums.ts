/** Ids of the prompts/skills/c4/*.md files; the TS constants are the fallback when the registry is off. */
export enum C4SkillId {
  SYSTEM = 'skill.c4.system',
  KNOWLEDGE_RULES = 'skill.c4.knowledge-rules',
  SPEC_SHAPE = 'skill.c4.spec-shape',
  UNIVERSAL_RULES = 'skill.c4.universal-rules',
  LEVEL_CONTEXT = 'skill.c4.level-context',
  LEVEL_CONTAINER = 'skill.c4.level-container',
  LEVEL_COMPONENT = 'skill.c4.level-component',
  LEVEL_SEQUENCE = 'skill.c4.level-sequence',
  JSON_RETRY = 'skill.c4.json-retry',
  EXTRACT = 'skill.c4.extract',
  DESIGN_READ = 'skill.c4.design-read',
  REVISE = 'skill.c4.revise',
  REVIEW_SYSTEM = 'skill.c4.review-system',
  REVIEW = 'skill.c4.review',
  CLARIFY_PARSE = 'skill.c4.clarify-parse',
  /** Design discussion T1–T7 (12/11 plan 04 §5.3). */
  DISCUSSION_SYSTEM = 'skill.c4.discussion-system',
  DISCUSSION = 'skill.c4.discussion',
  /** Critic checks 5–7: instances, infrastructure with a reason, connectivity (plan 04 §5.4). */
  CRITIC_DESIGN = 'skill.c4.critic-design',
}
