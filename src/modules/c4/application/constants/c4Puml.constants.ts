import { C4Direction, C4ElementKind, C4ElementVariant, C4Level } from '../../domain';

/** Same source as c4-plantuml-mcp-server (getPlantUMLImport), so images look identical. */
export const DEFAULT_C4_INCLUDE_BASE = 'https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master';

/** C4_INCLUDE_BASE value that switches to PlantUML's bundled stdlib (`!include <C4/...>`), no GitHub fetch. */
export const STDLIB_INCLUDE = 'stdlib';

export const C4_INCLUDE_FILE: Readonly<Record<C4Level, string>> = {
  [C4Level.CONTEXT]: 'C4_Context',
  [C4Level.CONTAINER]: 'C4_Container',
  [C4Level.COMPONENT]: 'C4_Component',
  [C4Level.SEQUENCE]: 'C4_Sequence',
};

/** getElementMacro of the repo: base macro, then Db/Queue, then _Ext. */
export const ELEMENT_MACRO: Readonly<Partial<Record<C4ElementKind, string>>> = {
  [C4ElementKind.PERSON]: 'Person',
  [C4ElementKind.SYSTEM]: 'System',
  [C4ElementKind.CONTAINER]: 'Container',
  [C4ElementKind.COMPONENT]: 'Component',
};

export const BOUNDARY_MACRO: Readonly<Partial<Record<C4ElementKind, string>>> = {
  [C4ElementKind.SYSTEM_BOUNDARY]: 'System_Boundary',
  [C4ElementKind.CONTAINER_BOUNDARY]: 'Container_Boundary',
  [C4ElementKind.BOUNDARY]: 'Boundary',
};

/** Sequence messages and relationships without a layout hint. */
export const PLAIN_REL_MACRO = 'Rel';

export const REL_MACRO: Readonly<Record<C4Direction, string>> = {
  [C4Direction.UP]: 'Rel_U',
  [C4Direction.DOWN]: 'Rel_D',
  [C4Direction.LEFT]: 'Rel_L',
  [C4Direction.RIGHT]: 'Rel_R',
};

export const VARIANT_SUFFIX: Readonly<Record<C4ElementVariant, string>> = {
  [C4ElementVariant.STANDARD]: '',
  [C4ElementVariant.DB]: 'Db',
  [C4ElementVariant.QUEUE]: 'Queue',
};

export const EXTERNAL_SUFFIX = '_Ext';

export const INDENT = '  ';

/** Line breaks/tabs inside a macro argument break the PlantUML line. */
export const LINE_BREAKS = /[\r\n\t]+/g;

export const REPEATED_SPACES = / {2,}/g;

export const DOUBLE_QUOTE = /"/g;

export const TRAILING_SLASHES = /\/+$/;
