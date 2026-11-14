import { ArtifactKind, MessageRole, type StoredArtifact } from '../../conversation-store';
import { LABEL_PREFIX, LABEL_SEPARATOR, LEVELS_JOINER } from './constants/context.constants';
import { stripDiacritics } from './helpers/textMatch.helper';

/** `A7` — the alias the model and the UI see. */
export function artifactAlias(artifact: Pick<StoredArtifact, 'ordinal'>): string {
  return `A${artifact.ordinal}`;
}

/** Turn number of a message: every turn writes a user then an assistant message. */
export function turnOf(seq: number | null): number | null {
  return seq === null ? null : Math.ceil(seq / 2);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** One level of a stored c4_spec (`data_json.levels[]`). */
export interface SpecLevel {
  level?: string;
  title?: string;
  missing?: unknown;
  spec?: unknown;
}

/** `levels[]` of a c4_spec data_json (empty for anything else). */
export function specLevels(artifact: Pick<StoredArtifact, 'kind' | 'dataJson'>): SpecLevel[] {
  const data = record(artifact.dataJson);
  if (artifact.kind !== ArtifactKind.C4_SPEC || !data || !Array.isArray(data.levels)) return [];
  return data.levels.map((l) => record(l) ?? {}) as SpecLevel[];
}

export function systemNameOf(artifact: Pick<StoredArtifact, 'dataJson'>): string | undefined {
  return str(record(artifact.dataJson)?.systemName);
}

/** Levels an artifact covers: the `level` column, else the spec's `levels[]`, else the PUML's `level`. */
export function levelsOf(artifact: Pick<StoredArtifact, 'kind' | 'dataJson' | 'level'>): string[] {
  if (artifact.level) return artifact.level.split(LEVELS_JOINER).filter(Boolean);
  const fromSpec = specLevels(artifact).map((l) => str(l.level)).filter((l): l is string => !!l);
  if (fromSpec.length > 0) return fromSpec;
  const single = str(record(artifact.dataJson)?.level);
  return single ? [single] : [];
}

export function ownerOf(artifact: Pick<StoredArtifact, 'kind' | 'owner'>): MessageRole {
  return artifact.owner ?? (artifact.kind === ArtifactKind.USER_IMAGE ? MessageRole.USER : MessageRole.ASSISTANT);
}

/** Element names (and tech) of a spec or a design note: the entity bag of the resolver. */
export function elementNames(artifact: Pick<StoredArtifact, 'kind' | 'dataJson'>): string[] {
  const names: string[] = [];
  const pushElements = (elements: unknown) => {
    if (!Array.isArray(elements)) return;
    for (const e of elements) {
      const el = record(e);
      if (typeof e === 'string') names.push(e);
      else if (el) for (const key of ['name', 'tech']) { const v = str(el[key]); if (v) names.push(v); }
    }
  };
  for (const level of specLevels(artifact)) pushElements(record(level.spec)?.elements);
  if (artifact.kind === ArtifactKind.DESIGN_NOTE) pushElements(record(artifact.dataJson)?.elements);
  return names;
}

export interface LabelInput {
  kind: ArtifactKind;
  systemName?: string;
  levels?: string[];
  version?: number;
  turn?: number | null;
}

/** Short readable name, generated on write without an LLM: `C4 container · Hệ thống đặt vé · v2`. */
export function artifactLabel(input: LabelInput): string {
  const level = input.levels?.length ? input.levels.join(LEVELS_JOINER) : '';
  const turn = input.turn ? `turn ${input.turn}` : '';
  const version = input.version && input.version > 1 ? `v${input.version}` : '';
  const join = (...parts: string[]) => parts.filter(Boolean).join(LABEL_SEPARATOR);
  const system = input.systemName ?? '';
  switch (input.kind) {
    case ArtifactKind.C4_SPEC: return join(`${LABEL_PREFIX.c4Spec}${level ? ` ${level}` : ''}`, system, version);
    case ArtifactKind.C4_PNG: return join(`${LABEL_PREFIX.c4Png}${level ? ` ${level}` : ''}`, system, version);
    case ArtifactKind.C4_PUML: return join(`${LABEL_PREFIX.c4Puml}${level ? ` ${level}` : ''}`, system, version);
    case ArtifactKind.USER_IMAGE: return join(LABEL_PREFIX.userImage, turn);
    case ArtifactKind.DESIGN_NOTE: return join(LABEL_PREFIX.designNote, system || turn, version);
    case ArtifactKind.PROBLEM_BRIEF: return join(LABEL_PREFIX.problemBrief, system || turn);
    case ArtifactKind.DESIGN_REVIEW: return join(LABEL_PREFIX.designReview, system || turn);
    case ArtifactKind.DESIGN_DISCUSSION: return join(LABEL_PREFIX.designDiscussion, system || turn);
    default: return join(String(input.kind), system || turn);
  }
}

/** Label for display: stored label, else the caption, else the kind. */
export function displayLabel(artifact: StoredArtifact): string {
  return artifact.label || artifact.caption || artifact.kind;
}

function sameSystem(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && stripDiacritics(a).replace(/\s+/g, ' ') === stripDiacritics(b).replace(/\s+/g, ' ');
}

/**
 * Version chain default (until revisions pass their parent explicitly): a new spec/design
 * note of a system that already has one in the conversation is its next version.
 */
export function inferVersion(existing: readonly StoredArtifact[], kind: ArtifactKind, systemName: string | undefined): { parentArtifactId?: string; version: number } {
  if (!systemName) return { version: 1 };
  const parent = [...existing].reverse().find((a) => a.kind === kind && sameSystem(systemNameOf(a), systemName));
  return parent ? { parentArtifactId: parent.id, version: (parent.version ?? 1) + 1 } : { version: 1 };
}
