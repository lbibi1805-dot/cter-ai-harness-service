import { C4ElementKind, isBoundary, type C4Element } from '../../domain';
import {
  BOUNDARY_MACRO,
  DOUBLE_QUOTE,
  ELEMENT_MACRO,
  EXTERNAL_SUFFIX,
  INDENT,
  LINE_BREAKS,
  REPEATED_SPACES,
  VARIANT_SUFFIX,
} from '../constants/c4Puml.constants';

/** Boundaries are emitted recursively with their children; elements whose parent is not a boundary go top-level. */
export function addElements(all: C4Element[], parent: string | undefined, indent: string, lines: string[], declared: Set<string>, path: Set<string>): void {
  const boundaries = new Set(all.filter((e) => isBoundary(e.kind)).map((e) => e.id));
  const children = all.filter((e) => (parent === undefined ? !e.parent || !boundaries.has(e.parent) : e.parent === parent));
  for (const e of children) {
    if (declared.has(e.id)) continue;
    declared.add(e.id);
    if (!isBoundary(e.kind)) {
      lines.push(indent + elementLine(e, false));
      continue;
    }
    if (path.has(e.id)) continue;
    path.add(e.id);
    lines.push(`${indent}${BOUNDARY_MACRO[e.kind] ?? BOUNDARY_MACRO[C4ElementKind.BOUNDARY]}(${e.id}, "${quote(e.name)}") {`);
    addElements(all, e.id, indent + INDENT, lines, declared, path);
    lines.push(`${indent}}`);
    path.delete(e.id);
  }
}

export function elementLine(e: C4Element, sequence: boolean): string {
  const macro = elementMacro(e, sequence);
  const withTech = e.kind === C4ElementKind.CONTAINER || e.kind === C4ElementKind.COMPONENT;
  return withTech
    ? `${macro}(${e.id}, "${quote(e.name)}", "${quote(e.tech)}", "${quote(e.desc)}")`
    : `${macro}(${e.id}, "${quote(e.name)}", "${quote(e.desc)}")`;
}

export function elementMacro(e: C4Element, sequence = false): string {
  const base = ELEMENT_MACRO[e.kind] ?? ELEMENT_MACRO[C4ElementKind.SYSTEM]!;
  const variant = e.kind === C4ElementKind.PERSON ? '' : VARIANT_SUFFIX[e.variant];
  return `${base}${variant}${e.external && !sequence ? EXTERNAL_SUFFIX : ''}`;
}

/** Text inside a "…" macro argument: single line, no raw double quotes. */
export function quote(text: string | undefined): string {
  return oneLine(text).replace(DOUBLE_QUOTE, "'");
}

export function oneLine(text: string | undefined): string {
  return (text ?? '').replace(LINE_BREAKS, ' ').replace(REPEATED_SPACES, ' ').trim();
}
