import { checkGraph, emptyConnectivity, type ConnectivityEdge, type ConnectivityNode } from './diagramConnectivity';
import { C4ElementKind, C4ElementVariant, ConnectivityCode } from './enums/c4.enums';
import type { ConnectivityReport } from './interfaces/c4.interface';

/** `Person(alias, "Label", …)`, `ContainerDb_Ext(alias, …)`, `ComponentQueue(alias, …)` — not boundaries. */
const ELEMENT_MACRO = /^\s*(Person|System|Container|Component)(Db|Queue)?(_Ext)?\s*\(\s*([A-Za-z_][\w.]*)\s*,([^\n]*)$/gm;

/** `Rel(a, b, …)`, `Rel_D`, `Rel_Back`, `BiRel`, `Rel_Neighbor`… */
const REL_MACRO = /^\s*(?:Bi)?Rel(?:_\w+)?\s*\(\s*([A-Za-z_][\w.]*)\s*,\s*([A-Za-z_][\w.]*)\s*(?:,\s*"([^"]*)")?/gm;

/** `RelIndex(1, a, b, …)` of C4 dynamic diagrams. */
const REL_INDEX_MACRO = /^\s*RelIndex(?:_\w+)?\s*\(\s*[^,]+,\s*([A-Za-z_][\w.]*)\s*,\s*([A-Za-z_][\w.]*)\s*(?:,\s*"([^"]*)")?/gm;

/** Raw arrows between aliases (`a --> b : label`), counted only when both ends are declared elements. */
const ARROW = /^\s*([A-Za-z_]\w*)\s+<?[-.]+(?:\[[^\]]*\])?[-.]*>?\s+([A-Za-z_]\w*)\s*(?::\s*(.*))?$/gm;

const KIND_BY_MACRO: Readonly<Record<string, C4ElementKind>> = {
  Person: C4ElementKind.PERSON,
  System: C4ElementKind.SYSTEM,
  Container: C4ElementKind.CONTAINER,
  Component: C4ElementKind.COMPONENT,
};

/** Rules a PlantUML block supports without a spec (plan 04 §4.3): orphans, split diagrams, one-sided queues. */
const PUML_RULES: ReadonlySet<ConnectivityCode> = new Set([
  ConnectivityCode.ORPHAN_ELEMENT,
  ConnectivityCode.DISCONNECTED_GRAPH,
  ConnectivityCode.QUEUE_ONE_SIDED,
]);

/**
 * Light semantic lint of a C4-PlantUML block the model wrote itself (chat / agent answers): aliases from the
 * element macros, edges from `Rel*` macros (and raw arrows). Not a C4 block (no element macro) → nothing to report.
 */
export function lintPlantUmlConnectivity(source: string): ConnectivityReport {
  const nodes = new Map<string, ConnectivityNode>();
  for (const match of source.matchAll(ELEMENT_MACRO)) {
    const [, base, variant, ext, alias, rest] = match;
    if (nodes.has(alias)) continue;
    nodes.set(alias, {
      id: alias,
      kind: KIND_BY_MACRO[base],
      variant: variant === 'Db' ? C4ElementVariant.DB : variant === 'Queue' ? C4ElementVariant.QUEUE : C4ElementVariant.STANDARD,
      external: !!ext,
      text: `${alias.replace(/_/g, ' ')} ${rest}`.toLowerCase(),
    });
  }
  if (nodes.size === 0) return emptyConnectivity();
  const edges: ConnectivityEdge[] = [];
  for (const pattern of [REL_MACRO, REL_INDEX_MACRO, ARROW]) {
    for (const [, from, to, label] of source.matchAll(pattern)) {
      if (nodes.has(from) && nodes.has(to)) edges.push({ from, to, label: (label ?? '').toLowerCase() });
    }
  }
  return checkGraph({ nodes: [...nodes.values()], edges, text: source.toLowerCase() }, PUML_RULES);
}
