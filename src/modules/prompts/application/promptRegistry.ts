import { ConfigurationError } from '../../../shared/errors';
import { ESSAY_RUBRIC_SECTION, PATH_SEPARATOR, PROMPT_FOLDERS, PROMPT_SECTION_SEPARATOR, STATIC_LAYER_ORDER } from '../domain/constants/prompt.constants';
import { PromptKind, PromptPath } from '../domain/enums/prompt.enums';
import { PromptId } from '../domain/constants/promptIds.constants';
import { matchesPattern, parseFrontmatter, promptOrder, shortHash } from '../domain/helpers/frontmatter.helper';
import type { DomainPrompt, PromptFile, PromptLayerEntry, PromptListEntry, RawPromptFile, SkillPrompt } from '../domain/interfaces/prompt.interface';

const FILE_EXTENSION = /\.md$/i;

function kindOf(path: string): PromptKind | null {
  return PROMPT_FOLDERS[path.split(PATH_SEPARATOR)[0]] ?? null;
}

function baseName(path: string): string {
  return path.split(PATH_SEPARATOR).pop()!.replace(FILE_EXTENSION, '');
}

/** A domain body as it goes into the static system prompt: Essay Mode sections removed. */
function withoutEssayRubric(body: string): string {
  return body.replace(ESSAY_RUBRIC_SECTION, PROMPT_SECTION_SEPARATOR).trim();
}

/**
 * Part of layer ①: core always; policies unless `static: false` (e.g. the reminder, placed after the question);
 * domains only with `static: true`.
 */
function isStaticFile(file: PromptFile): boolean {
  if (!STATIC_LAYER_ORDER.includes(file.kind)) return false;
  if (file.kind === PromptKind.DOMAIN) return file.meta.static === true;
  return file.meta.static !== false;
}

function byOrderThenPath(a: PromptFile, b: PromptFile): number {
  return promptOrder(a.meta) - promptOrder(b.meta) || a.path.localeCompare(b.path);
}

/** `id@version` + body size of one composed file. */
export function layerEntry(file: PromptFile): PromptLayerEntry {
  return { id: file.meta.id, version: file.meta.version, chars: withoutEssayRubric(file.body).length };
}

/**
 * Versioned prompt files (`prompts/` in git): core + policies (+ `static: true` domains) compose the
 * static system prompt — layer ① of the cache-friendly layout (18 §4), byte-identical for every request;
 * other domains and skills are looked up on demand. `promptVersion` is the short sha256 of that composition.
 */
export class PromptRegistry {
  readonly systemPrompt: string;
  readonly promptVersion: string;
  private readonly files: PromptFile[];
  private readonly active: Set<PromptFile>;
  private readonly staticFiles: PromptFile[];

  /** Validates every file (missing frontmatter or duplicate id throws ConfigurationError). */
  constructor(rawFiles: RawPromptFile[]) {
    const ids = new Set<string>();
    this.files = rawFiles
      .map((raw) => ({ raw, kind: kindOf(raw.path) }))
      .filter((entry): entry is { raw: RawPromptFile; kind: PromptKind } => entry.kind !== null)
      .map(({ raw, kind }) => {
        const { meta, body } = parseFrontmatter(raw.content, raw.path);
        if (ids.has(meta.id)) throw new ConfigurationError(`Prompt ${raw.path}: duplicate id "${meta.id}"`);
        ids.add(meta.id);
        return { kind, path: raw.path, meta, body, hash: shortHash(body) };
      })
      .sort(byOrderThenPath);
    if (!this.files.some((file) => file.kind === PromptKind.CORE)) throw new ConfigurationError('Prompt registry: no core prompt (prompts/core/*.md)');

    // Sorted by `order` across layers (12/11 02): policies/precedence.md (order 0) opens the prompt, before core.
    const staticFiles = this.files.filter(isStaticFile);
    this.active = new Set(staticFiles);
    this.staticFiles = staticFiles;
    this.systemPrompt = staticFiles.map((file) => withoutEssayRubric(file.body)).filter(Boolean).join(PROMPT_SECTION_SEPARATOR);
    this.promptVersion = shortHash(this.systemPrompt);
  }

  /** A domain by id (`domain.usability-engineering`) or file name (`usability-engineering`). */
  domain(courseId: string): DomainPrompt | null {
    return this.findOf(PromptKind.DOMAIN, courseId);
  }

  /** A policy by id (`policy.reminder`) or file name (`reminder`), static or not. */
  policy(id: string): PromptFile | null {
    return this.findOf(PromptKind.POLICY, id);
  }

  /** The static layer ① in composition order: `id@version` and size of each file (monitoring, `trace.prompt`). */
  staticLayers(): PromptLayerEntry[] {
    return this.staticFiles.map(layerEntry);
  }

  /**
   * Shared rules of /c4 (12/11 02 Bước 4): instruction precedence + the System Architecture domain, composed in
   * front of `skill.c4.system`, so /c4 and chat follow one source of C4 rules. Empty when the files are missing.
   */
  c4Rules(): string {
    return this.c4RuleFiles().map((file) => withoutEssayRubric(file.body)).join(PROMPT_SECTION_SEPARATOR);
  }

  /**
   * What each path sends, in order: system-prompt layers, then the user-turn reminder (`trace.prompt`,
   * `GET /api/prompts`). Data blocks (history, reference material, question) are not prompt files.
   */
  composition(path: PromptPath): PromptLayerEntry[] {
    const reminder = this.policy(PromptId.REMINDER);
    const tail = reminder && reminder.meta.static === false ? [layerEntry(reminder)] : [];
    const skill = (id: string) => { const file = this.skill(id); return file ? [layerEntry(file)] : []; };
    switch (path) {
      case PromptPath.AGENT: return [...this.staticLayers(), ...skill(PromptId.RESEARCH_MODE), ...tail];
      case PromptPath.ESSAY: return [...this.staticLayers(), ...skill(PromptId.ESSAY_WRITER), ...tail];
      case PromptPath.C4: return [...this.c4RuleFiles().map(layerEntry), ...skill(PromptId.C4_SYSTEM), ...tail];
      default: return [...this.staticLayers(), ...tail];
    }
  }

  private c4RuleFiles(): PromptFile[] {
    return [this.policy(PromptId.PRECEDENCE), this.domain(PromptId.C4_DOMAIN)].filter((file): file is PromptFile => file !== null);
  }

  /** A skill by id (`skill.c4.architect`) or file name (`architect`). */
  skill(id: string): SkillPrompt | null {
    return this.findOf(PromptKind.SKILL, id);
  }

  /**
   * The domain whose `match` patterns cover most of the given RAG sources (vault paths such as
   * `software-tesing-ISYS2092-SYS3397/week1.md`); ties keep the first by order. Null when none match.
   */
  selectDomain(sources: string[]): DomainPrompt | null {
    let best: DomainPrompt | null = null;
    let bestCount = 0;
    for (const domain of this.files.filter((file) => file.kind === PromptKind.DOMAIN)) {
      const patterns = domain.meta.match ?? [];
      const count = sources.filter((source) => patterns.some((pattern) => matchesPattern(source, pattern))).length;
      if (count > bestCount) {
        best = domain;
        bestCount = count;
      }
    }
    return best;
  }

  /** The `<essay_rubric>` section of a domain (Essay Mode, 15 §4.1); null when the domain has none. */
  essayRubric(domain: DomainPrompt): string | null {
    const sections = [...domain.body.matchAll(ESSAY_RUBRIC_SECTION)].map((match) => match[1].trim()).filter(Boolean);
    return sections.length ? sections.join(PROMPT_SECTION_SEPARATOR) : null;
  }

  /** Every loaded file, for monitoring (`GET /api/prompts`). */
  list(): PromptListEntry[] {
    return this.files.map((file) => ({
      id: file.meta.id,
      kind: file.kind,
      path: file.path,
      version: file.meta.version,
      owner: file.meta.owner,
      hash: file.hash,
      active: this.active.has(file),
    }));
  }

  private findOf(kind: PromptKind, key: string): PromptFile | null {
    return this.files.find((file) => file.kind === kind && (file.meta.id === key || baseName(file.path) === key)) ?? null;
  }
}
