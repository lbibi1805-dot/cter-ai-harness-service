import { attemptSync } from '../../../../shared/resilience';
import { parseC4Level, toDiagramSpec, type C4Level, type C4Requirement } from '../../domain';
import { CODE_FENCE, REVISE_VERDICT } from '../constants/c4Sketch.constants';
import type { C4Critique, C4SpecsByLevel } from '../interfaces/c4Sketch.interface';

/** The JSON object in a model answer: inside a ``` fence if there is one, else the first balanced {...}. */
export function extractJsonObject(answer: string): Record<string, unknown> | undefined {
  const fenced = CODE_FENCE.exec(answer)?.[1];
  for (const candidate of [fenced, answer]) {
    const json = candidate ? firstBalancedObject(candidate) : undefined;
    if (!json) continue;
    const parsed = attemptSync(() => JSON.parse(json) as unknown);
    if (parsed.ok && parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)) {
      return parsed.value as Record<string, unknown>;
    }
  }
  return undefined;
}

function firstBalancedObject(text: string): string | undefined {
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return undefined;
}

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
