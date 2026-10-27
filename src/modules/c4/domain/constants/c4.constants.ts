import { C4ElementKind, C4ElementVariant, C4Level } from '../enums/c4.enums';

/** Order levels are drawn and reported in, whatever order the client asked for. */
export const C4_LEVEL_ORDER: readonly C4Level[] = [C4Level.CONTEXT, C4Level.CONTAINER, C4Level.COMPONENT, C4Level.SEQUENCE];

/** Requested when the client names no level: the two diagrams most exam questions ask for. */
export const DEFAULT_C4_LEVELS: readonly C4Level[] = [C4Level.CONTEXT, C4Level.CONTAINER];

/** Short names accepted for levels (client flags --ctx/--cnt/--cmp/--seq, LLM-written map keys). */
export const C4_LEVEL_ALIASES: Readonly<Record<string, C4Level>> = {
  context: C4Level.CONTEXT,
  ctx: C4Level.CONTEXT,
  c1: C4Level.CONTEXT,
  container: C4Level.CONTAINER,
  cnt: C4Level.CONTAINER,
  c2: C4Level.CONTAINER,
  component: C4Level.COMPONENT,
  cmp: C4Level.COMPONENT,
  c3: C4Level.COMPONENT,
  sequence: C4Level.SEQUENCE,
  seq: C4Level.SEQUENCE,
  dynamic: C4Level.SEQUENCE,
};

/** Kinds an LLM tends to write instead of ours; unknown kinds fall back to SYSTEM. */
export const C4_KIND_ALIASES: Readonly<Record<string, C4ElementKind>> = {
  person: C4ElementKind.PERSON,
  actor: C4ElementKind.PERSON,
  user: C4ElementKind.PERSON,
  system: C4ElementKind.SYSTEM,
  container: C4ElementKind.CONTAINER,
  containerdb: C4ElementKind.CONTAINER,
  database: C4ElementKind.CONTAINER,
  db: C4ElementKind.CONTAINER,
  queue: C4ElementKind.CONTAINER,
  component: C4ElementKind.COMPONENT,
  system_boundary: C4ElementKind.SYSTEM_BOUNDARY,
  systemboundary: C4ElementKind.SYSTEM_BOUNDARY,
  container_boundary: C4ElementKind.CONTAINER_BOUNDARY,
  containerboundary: C4ElementKind.CONTAINER_BOUNDARY,
  boundary: C4ElementKind.BOUNDARY,
  enterprise_boundary: C4ElementKind.BOUNDARY,
};

export const BOUNDARY_KINDS: ReadonlySet<C4ElementKind> = new Set([
  C4ElementKind.SYSTEM_BOUNDARY,
  C4ElementKind.CONTAINER_BOUNDARY,
  C4ElementKind.BOUNDARY,
]);

/** c4-diagrams skill: containers and components always carry a technology. */
export const KINDS_NEEDING_TECH: ReadonlySet<C4ElementKind> = new Set([C4ElementKind.CONTAINER, C4ElementKind.COMPONENT]);

/** Which element kinds belong at each level (boundaries/_Ext are flattened away for sequence). */
export const ALLOWED_KINDS: Readonly<Record<C4Level, ReadonlySet<C4ElementKind>>> = {
  [C4Level.CONTEXT]: new Set([C4ElementKind.PERSON, C4ElementKind.SYSTEM, C4ElementKind.BOUNDARY]),
  [C4Level.CONTAINER]: new Set([
    C4ElementKind.PERSON, C4ElementKind.SYSTEM, C4ElementKind.CONTAINER, C4ElementKind.SYSTEM_BOUNDARY, C4ElementKind.BOUNDARY,
  ]),
  [C4Level.COMPONENT]: new Set(Object.values(C4ElementKind)),
  [C4Level.SEQUENCE]: new Set(Object.values(C4ElementKind)),
};

/** C4: the context and container diagrams show the same people and external systems. */
export const LEVELS_SHOWING_ACTORS: ReadonlySet<C4Level> = new Set([C4Level.CONTEXT, C4Level.CONTAINER]);

/** best-practices.md of the c4-diagrams skill: "Aim for 5-12 elements per diagram". */
export const DEFAULT_MAX_ELEMENTS = 12;

export const MIN_MAX_ELEMENTS = 4;

export const MAX_MAX_ELEMENTS = 30;

/** PlantUML identifiers: ASCII word characters, not starting with a digit. */
export const NON_ID_CHARS = /[^A-Za-z0-9_]/g;

export const LEADING_DIGIT = /^[0-9]/;

export const ID_DIGIT_PREFIX = 'e_';

/** "Container Boundary" / "container-boundary" → container_boundary before alias lookup. */
export const KIND_SEPARATORS = /[-\s]/g;

/** Kind aliases that also say which variant the element is ("database" → container + db). */
export const C4_KIND_IMPLIED_VARIANT: Readonly<Record<string, C4ElementVariant>> = {
  containerdb: C4ElementVariant.DB,
  database: C4ElementVariant.DB,
  db: C4ElementVariant.DB,
  queue: C4ElementVariant.QUEUE,
};
