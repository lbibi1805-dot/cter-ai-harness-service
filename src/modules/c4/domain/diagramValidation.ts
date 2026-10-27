import { ALLOWED_KINDS, KINDS_NEEDING_TECH, LEVELS_SHOWING_ACTORS } from './constants/c4.constants';
import { C4ElementKind, C4Level } from './enums/c4.enums';
import { isBoundary } from './helpers/c4.helper';
import { flattenForSequence, hasParentCycle, pruneUnused } from './helpers/diagramValidation.helper';
import type { C4DiagramSpec, C4Requirement, C4Validation, C4ValidationRules } from './interfaces/c4.interface';

/**
 * Deterministic checks between the model calls. Applies the c4-diagrams skill rules (unique ids,
 * technology on containers/components, no boundaries/_Ext in sequence diagrams), requires every
 * requirement of the level to be claimed by an element or relationship, and prunes elements that cover
 * nothing and connect to nothing — "minimal but sufficient". Returns a fixed copy; the input is untouched.
 */
export function validateDiagram(
  input: C4DiagramSpec,
  level: C4Level,
  requirements: readonly C4Requirement[],
  rules: C4ValidationRules,
): C4Validation {
  const spec: C4DiagramSpec = structuredClone(input);
  const errors: string[] = [];
  if (!spec.title) spec.title = `${level} diagram`;
  // Users are drawn as Person (the repo's look), never the grey Person_Ext.
  for (const e of spec.elements) if (e.kind === C4ElementKind.PERSON) e.external = false;

  if (level === C4Level.SEQUENCE) flattenForSequence(spec);
  else {
    const boundaries = new Set(spec.elements.filter((e) => isBoundary(e.kind)).map((e) => e.id));
    for (const e of spec.elements) {
      if (e.parent && (!boundaries.has(e.parent) || e.parent === e.id || hasParentCycle(spec, e))) e.parent = undefined;
    }
    // C4-PlantUML relationships connect elements, not boundaries.
    spec.rels = spec.rels.filter((r) => !boundaries.has(r.from) && !boundaries.has(r.to));
    // The same edge and label twice adds nothing (sequence diagrams may legitimately repeat a call).
    const seen = new Set<string>();
    spec.rels = spec.rels.filter((r) => {
      const key = `${r.from}|${r.to}|${r.label.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const ids = new Set<string>();
  for (const e of spec.elements) {
    if (ids.has(e.id)) errors.push(`Duplicate element id '${e.id}'.`);
    ids.add(e.id);
    if (!e.name) errors.push(`Element '${e.id}' has no name.`);
    if (!e.desc && !isBoundary(e.kind) && level !== C4Level.SEQUENCE) errors.push(`Element '${e.id}' needs a short description (desc).`);
    if (KINDS_NEEDING_TECH.has(e.kind) && !e.tech) errors.push(`${e.kind} '${e.id}' needs a technology (tech).`);
    if (!ALLOWED_KINDS[level].has(e.kind)) errors.push(`Element '${e.id}' of kind '${e.kind}' does not belong in a ${level} diagram.`);
  }
  for (const r of spec.rels) {
    if (!ids.has(r.from)) errors.push(`Relationship '${r.label}' starts at unknown id '${r.from}'.`);
    if (!ids.has(r.to)) errors.push(`Relationship '${r.label}' ends at unknown id '${r.to}'.`);
    if (!r.label) errors.push(`Relationship ${r.from} -> ${r.to} needs a label.`);
  }

  pruneUnused(spec);

  const nodes = spec.elements.filter((e) => !isBoundary(e.kind)).length;
  if (nodes === 0) errors.push('The diagram has no elements.');
  if (spec.rels.length === 0) errors.push('The diagram has no relationships.');
  if (nodes > rules.maxElements) {
    errors.push(`Too many elements (${nodes} > ${rules.maxElements}): merge or drop elements that no requirement needs.`);
  }

  // Coverage claims alone can be gamed (a container "covering" SSO login); actors and external systems are checked by id.
  if (LEVELS_SHOWING_ACTORS.has(level)) {
    const present = new Set(spec.elements.map((e) => e.id));
    const linked = new Set(spec.rels.flatMap((r) => [r.from, r.to]));
    for (const required of rules.requiredElements ?? []) {
      if (!present.has(required.id)) {
        errors.push(`'${required.name}' (id ${required.id}) from the shared model is missing: ${level} diagrams show every actor and external system, connected by a relationship.`);
      } else if (!linked.has(required.id)) {
        errors.push(`'${required.name}' (id ${required.id}) has no relationship: connect it to the element it uses or that uses it.`);
      }
    }
  }

  // Coverage: every requirement of this level must be claimed somewhere.
  const levelRequirements = requirements.filter((req) => req.levels.length === 0 || req.levels.includes(level));
  const claimed = new Set([...spec.elements.flatMap((e) => e.covers), ...spec.rels.flatMap((r) => r.covers)].map((id) => id.toLowerCase()));
  const covered = levelRequirements.filter((req) => claimed.has(req.id.toLowerCase())).map((req) => req.id);
  const missing = levelRequirements.filter((req) => !claimed.has(req.id.toLowerCase()));
  for (const req of missing) errors.push(`Requirement ${req.id} is not covered: ${req.text}`);

  return { spec, errors, covered, missing: missing.map((req) => req.id), score: errors.length + missing.length };
}
