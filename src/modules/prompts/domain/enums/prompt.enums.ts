/** Layer of a prompt file, taken from its top-level folder under `prompts/`. */
export enum PromptKind {
  /** Identity, behaviour, output format: always in the static system prompt. */
  CORE = 'core',
  /** Cross-cutting rules (language, citation): always in the static system prompt. */
  POLICY = 'policy',
  /** Per-course rubric: selected by route or dominant RAG folder (or `static: true` until that is wired). */
  DOMAIN = 'domain',
  /** Loaded only when a skill runs (e.g. C4). */
  SKILL = 'skill',
}

/** Answering paths whose prompt the registry composes (`GET /api/prompts` → `compositions`, `trace.prompt`). */
export enum PromptPath {
  SINGLE = 'single',
  AGENT = 'agent',
  ESSAY = 'essay',
  C4 = 'c4',
}

/** Kind of a stored eval run (`GET /api/evals` → `kind`). */
export enum EvalKind {
  GOLDEN_QA = 'golden-qa',
  RULE_COMPLIANCE = 'rule-compliance',
}

/** Frontmatter keys of a prompt file. */
export enum PromptField {
  ID = 'id',
  VERSION = 'version',
  OWNER = 'owner',
  DESCRIPTION = 'description',
  ORDER = 'order',
  MATCH = 'match',
  STATIC = 'static',
}
