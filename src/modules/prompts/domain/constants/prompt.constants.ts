import { PromptField, PromptKind } from '../enums/prompt.enums';

/** Top-level folder → layer. Files outside these folders (e.g. a README) are ignored. */
export const PROMPT_FOLDERS: Readonly<Record<string, PromptKind>> = {
  core: PromptKind.CORE,
  policies: PromptKind.POLICY,
  domains: PromptKind.DOMAIN,
  skills: PromptKind.SKILL,
};

/** Order of the layers in the composed static system prompt (layer ① of the cache-friendly layout, 18 §4). */
export const STATIC_LAYER_ORDER: readonly PromptKind[] = [PromptKind.CORE, PromptKind.POLICY, PromptKind.DOMAIN];

export const REQUIRED_PROMPT_FIELDS: readonly PromptField[] = [PromptField.ID, PromptField.VERSION, PromptField.OWNER, PromptField.DESCRIPTION];

/** The registry is considered present when this file exists under the prompts root. */
export const CORE_PROMPT_PATH = 'core/system.md';

export const PROMPT_FILE_EXTENSION = '.md';

export const FRONTMATTER_DELIMITER = '---';

/** Between composed prompt files. */
export const PROMPT_SECTION_SEPARATOR = '\n\n';

/** Hex characters of the sha256 kept as `promptVersion` / per-file hash. */
export const PROMPT_HASH_LENGTH = 12;

export const PROMPT_HASH_ALGORITHM = 'sha256';

/** Files without `order` sort after those with one (then by path). */
export const DEFAULT_PROMPT_ORDER = 1000;

/** Separator of relative prompt paths and RAG sources. */
export const PATH_SEPARATOR = '/';

export const GLOB_WILDCARD = '*';

export const FRONTMATTER_TRUE = 'true';

/**
 * `<essay_rubric>…</essay_rubric>` inside a domain file (15 §4.1): used by Essay Mode only, so it is cut
 * out of the composed static system prompt (layer ① and promptVersion stay unchanged).
 */
export const ESSAY_RUBRIC_SECTION = /\s*<essay_rubric>([\s\S]*?)<\/essay_rubric>\s*/g;
