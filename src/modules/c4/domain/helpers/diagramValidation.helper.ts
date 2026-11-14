import type { C4DiagramSpec, C4Element } from '../interfaces/c4.interface';
import { isBoundary } from './c4.helper';

/** c4-diagrams skill: sequence diagrams take a flat participant list without boundaries or _Ext. */
export function flattenForSequence(spec: C4DiagramSpec): void {
  spec.elements = spec.elements.filter((e) => !isBoundary(e.kind));
  for (const e of spec.elements) {
    e.parent = undefined;
    e.external = false;
  }
}

export function hasParentCycle(spec: C4DiagramSpec, start: C4Element): boolean {
  const byId = new Map(spec.elements.map((e) => [e.id, e]));
  const seen = new Set([start.id]);
  for (let parent = start.parent; parent; parent = byId.get(parent)?.parent) {
    if (seen.has(parent)) return true;
    seen.add(parent);
  }
  return false;
}

/**
 * Drops elements that cover no requirement and take part in no relationship, then boundaries left empty.
 * Returns the ids of the dropped (non-boundary) elements, so the drop is reported instead of silent (plan 04 §4.1).
 * An element that covers a requirement but has no relationship is kept: the connectivity check reports it.
 */
export function pruneUnused(spec: C4DiagramSpec): string[] {
  const linked = new Set(spec.rels.flatMap((r) => [r.from, r.to]));
  const pruned = spec.elements.filter((e) => !isBoundary(e.kind) && e.covers.length === 0 && !linked.has(e.id)).map((e) => e.id);
  spec.elements = spec.elements.filter((e) => isBoundary(e.kind) || e.covers.length > 0 || linked.has(e.id));
  for (;;) {
    const parents = new Set(spec.elements.map((e) => e.parent).filter(Boolean));
    const kept = spec.elements.filter((e) => !isBoundary(e.kind) || parents.has(e.id));
    if (kept.length === spec.elements.length) return pruned;
    spec.elements = kept;
  }
}
