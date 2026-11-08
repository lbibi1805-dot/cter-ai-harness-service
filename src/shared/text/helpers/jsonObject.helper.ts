import { attemptSync } from '../../resilience/attempt';
import { JSON_CODE_FENCE } from '../constants/jsonObject.constants';

/** The JSON object in a model answer: inside a ``` fence if there is one, else the first balanced {...}. */
export function extractJsonObject(answer: string): Record<string, unknown> | undefined {
  const fenced = JSON_CODE_FENCE.exec(answer)?.[1];
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
