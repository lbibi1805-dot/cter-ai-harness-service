import type { PromptKind } from '../enums/prompt.enums';

/** Parsed frontmatter of a prompt file (`id`, `version`, `owner`, `description` are required). */
export interface PromptFrontmatter {
  id: string;
  version: string;
  owner: string;
  description: string;
  /** Position inside its layer (lower first); files without one come after, by path. */
  order?: number;
  /** Domains only: vault folder prefixes / globs (`software-tes*ing-*`) used by `selectDomain`. */
  match?: string[];
  /**
   * Domains: part of the static system prompt only with `true`. Policies: in it unless `false`
   * (e.g. `policies/reminder.md`, appended after the question instead).
   */
  static?: boolean;
}

export interface PromptFile {
  kind: PromptKind;
  /** Path relative to the prompts root, `/`-separated (e.g. `skills/c4/architect.md`). */
  path: string;
  meta: PromptFrontmatter;
  /** Body without frontmatter, trimmed. */
  body: string;
  /** Short sha256 of the body. */
  hash: string;
}

export type DomainPrompt = PromptFile;

export type SkillPrompt = PromptFile;

/** One row of `list()` (for the `GET /api/prompts` monitoring endpoint). */
export interface PromptListEntry {
  id: string;
  kind: PromptKind;
  path: string;
  version: string;
  owner: string;
  hash: string;
  /** Part of the composed static system prompt. */
  active: boolean;
}

/** A file as read from disk, before validation. */
export interface RawPromptFile {
  /** Relative to the prompts root, `/`-separated. */
  path: string;
  content: string;
}

/** One composed file in a prompt (`GET /api/prompts` compositions, `trace.prompt`). */
export interface PromptLayerEntry {
  id: string;
  version: string;
  /** Characters of the composed text of this layer. */
  chars: number;
}
