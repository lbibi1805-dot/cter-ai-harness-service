import { BOUNDARY_KINDS, C4_KIND_ALIASES, C4_LEVEL_ALIASES, ID_DIGIT_PREFIX, C4_KIND_IMPLIED_VARIANT, KIND_SEPARATORS, LEADING_DIGIT, NON_ID_CHARS } from '../constants/c4.constants';
import { C4Direction, C4ElementKind, C4ElementVariant, type C4Level } from '../enums/c4.enums';
import type { C4DiagramSpec, C4Element, C4KindParse, C4ModelElement, C4Relationship } from '../interfaces/c4.interface';

export function parseC4Level(raw: unknown): C4Level | undefined {
  return typeof raw === 'string' ? C4_LEVEL_ALIASES[raw.trim().toLowerCase()] : undefined;
}

export function isBoundary(kind: C4ElementKind): boolean {
  return BOUNDARY_KINDS.has(kind);
}

/** Valid PlantUML identifier; also used to compare ids written by the model. */
export function safeId(raw: unknown): string {
  const id = (typeof raw === 'string' ? raw.trim() : '').replace(NON_ID_CHARS, '_');
  if (!id) return '_';
  return LEADING_DIGIT.test(id) ? `${ID_DIGIT_PREFIX}${id}` : id;
}

function text(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : typeof raw === 'number' ? String(raw) : '';
}

function optionalText(raw: unknown): string | undefined {
  return text(raw) || undefined;
}

function stringList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(text).filter(Boolean);
  const single = text(raw);
  return single ? [single] : [];
}

function toKind(raw: unknown): C4KindParse {
  const key = text(raw).toLowerCase().replace(KIND_SEPARATORS, '_');
  return { kind: C4_KIND_ALIASES[key] ?? C4ElementKind.SYSTEM, impliedVariant: C4_KIND_IMPLIED_VARIANT[key] };
}

function toVariant(raw: unknown, implied?: C4ElementVariant): C4ElementVariant {
  const value = text(raw).toLowerCase();
  return Object.values(C4ElementVariant).find((variant) => variant === value) ?? implied ?? C4ElementVariant.STANDARD;
}

function toDirection(raw: unknown): C4Direction | undefined {
  const value = text(raw).toUpperCase().charAt(0);
  return Object.values(C4Direction).find((dir) => dir === value);
}

/** Actors/external systems of the architect's shared model, ids sanitised like diagram ids. */
export function toModelElements(raw: unknown): C4ModelElement[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}))
    .filter((e) => text(e.id))
    .map((e) => ({ id: safeId(e.id), name: text(e.name) || text(e.id) }));
}

/** Coerces whatever JSON the model returned into a spec with sanitised ids; never throws. */
export function toDiagramSpec(raw: unknown): C4DiagramSpec {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const elements = (Array.isArray(body.elements) ? body.elements : []).map((item): C4Element => {
    const e = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const { kind, impliedVariant } = toKind(e.kind);
    const parent = optionalText(e.parent);
    return {
      id: safeId(e.id),
      kind,
      variant: toVariant(e.variant, impliedVariant),
      external: e.external === true,
      name: text(e.name),
      desc: text(e.desc ?? e.description),
      tech: optionalText(e.tech ?? e.technology),
      parent: parent && parent !== 'null' ? safeId(parent) : undefined,
      covers: stringList(e.covers),
    };
  });
  const rels = (Array.isArray(body.rels) ? body.rels : Array.isArray(body.relationships) ? body.relationships : []).map((item): C4Relationship => {
    const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      from: safeId(r.from ?? r.source),
      to: safeId(r.to ?? r.target),
      label: text(r.label ?? r.description),
      tech: optionalText(r.tech ?? r.technology),
      dir: toDirection(r.dir),
      phase: optionalText(r.phase),
      covers: stringList(r.covers),
    };
  });
  return { title: text(body.title), elements, rels };
}
