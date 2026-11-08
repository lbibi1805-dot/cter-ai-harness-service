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
