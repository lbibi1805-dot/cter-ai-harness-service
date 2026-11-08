import { ConfigurationError } from '../../../shared/errors';
import { ESSAY_RUBRIC_SECTION, PATH_SEPARATOR, PROMPT_FOLDERS, PROMPT_SECTION_SEPARATOR, STATIC_LAYER_ORDER } from '../domain/constants/prompt.constants';
import { PromptKind } from '../domain/enums/prompt.enums';
import { matchesPattern, parseFrontmatter, promptOrder, shortHash } from '../domain/helpers/frontmatter.helper';
import type { DomainPrompt, PromptFile, PromptListEntry, RawPromptFile, SkillPrompt } from '../domain/interfaces/prompt.interface';

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

function byOrderThenPath(a: PromptFile, b: PromptFile): number {
  return promptOrder(a.meta) - promptOrder(b.meta) || a.path.localeCompare(b.path);
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

    const staticFiles = STATIC_LAYER_ORDER.flatMap((kind) =>
      this.files.filter((file) => file.kind === kind && (kind !== PromptKind.DOMAIN || file.meta.static === true)));
    this.active = new Set(staticFiles);
    this.systemPrompt = staticFiles.map((file) => withoutEssayRubric(file.body)).filter(Boolean).join(PROMPT_SECTION_SEPARATOR);
    this.promptVersion = shortHash(this.systemPrompt);
  }

  /** A domain by id (`domain.usability-engineering`) or file name (`usability-engineering`). */
  domain(courseId: string): DomainPrompt | null {
    return this.findOf(PromptKind.DOMAIN, courseId);
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
