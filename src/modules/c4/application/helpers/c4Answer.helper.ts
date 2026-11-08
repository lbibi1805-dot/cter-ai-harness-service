import { extractJsonObject } from '../../../../shared/text';
import type { CitedChunk } from '../../../retrieval';
import { parseC4Level, toDiagramSpec, toModelElements, type C4Level, type C4Requirement } from '../../domain';
import { MAX_CLARIFICATIONS, REVISE_VERDICT } from '../constants/c4Sketch.constants';
import type { C4ArchitectPlan, C4Clarification, C4Critique, C4SpecsByLevel } from '../interfaces/c4Sketch.interface';

export { extractJsonObject };

function entries(raw: unknown): Array<[string, unknown]> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.entries(raw) : [];
}

/** Requirement checklist; missing ids become R1, R2…, unknown level names are dropped. */
export function toRequirements(raw: unknown): C4Requirement[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, i) => {
      const r = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `R${i + 1}`;
      const text = typeof r.text === 'string' ? r.text.trim() : '';
      const levels = (Array.isArray(r.levels) ? r.levels : []).map(parseC4Level).filter((l): l is C4Level => l !== undefined);
      return { id, text, levels };
    })
    .filter((req) => req.text);
}

/** `{ "container": <spec>, "Context": <spec> }` → specs keyed by level (keys are matched loosely). */
export function toSpecsByLevel(raw: unknown): C4SpecsByLevel {
  const specs: C4SpecsByLevel = new Map();
  for (const [key, value] of entries(raw)) {
    const level = parseC4Level(key);
    if (level && value && typeof value === 'object') specs.set(level, toDiagramSpec(value));
  }
  return specs;
}

export function toCritiques(raw: unknown): Map<C4Level, C4Critique> {
  const critiques = new Map<C4Level, C4Critique>();
  for (const [key, value] of entries(raw)) {
    const level = parseC4Level(key);
    if (!level || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const revise = typeof v.verdict === 'string' && v.verdict.toLowerCase() === REVISE_VERDICT && !!v.spec && typeof v.spec === 'object';
    critiques.set(level, {
      revise,
      issues: Array.isArray(v.issues) ? v.issues.filter((issue): issue is string => typeof issue === 'string') : [],
      spec: revise ? toDiagramSpec(v.spec) : undefined,
    });
  }
  return critiques;
}

/** Questions the architect wants answered; each needs both a question and the assumption drawn meanwhile. */
export function toClarifications(raw: unknown): C4Clarification[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : {}))
    .map((c) => ({
      question: typeof c.question === 'string' ? c.question.trim() : '',
      assumption: typeof c.assumption === 'string' ? c.assumption.trim() : '',
    }))
    .filter((c) => c.question)
    .slice(0, MAX_CLARIFICATIONS);
}

/** The architect's JSON answer as a plan; an unusable answer (undefined) gives an empty plan the drafters fill. */
export function toArchitectPlan(raw: Record<string, unknown> | undefined, maxElements: number): C4ArchitectPlan {
  const body = raw ?? {};
  const model = body.model && typeof body.model === 'object' ? (body.model as Record<string, unknown>) : {};
  return {
    systemName: typeof body.systemName === 'string' ? body.systemName : '',
    requirements: toRequirements(body.requirements),
    drafted: toSpecsByLevel(body.diagrams),
    modelJson: JSON.stringify(model),
    rules: { maxElements, requiredElements: [...toModelElements(model.actors), ...toModelElements(model.externalSystems)] },
    clarifications: toClarifications(body.clarifications),
  };
}

/** Vault files the knowledge chunks came from (shown to the user). */
export function sourcesOf(knowledge: readonly CitedChunk[]): string[] {
  return [...new Set(knowledge.map((chunk) => chunk.source))];
}
