/** One labelled question of the golden set (one JSON object per line). */
export interface GoldenItem {
  id: string;
  question: string;
  /**
   * Vault-relative file paths that answer the question, e.g.
   * "mon-qnx-current/lab-4/Barriers.md". Labelled per file (not per chunk id)
   * because chunk ids change whenever the vault is re-indexed.
   */
  expectedSources: string[];
  /** Ideas a complete answer must mention — used by the generation eval later. */
  keyPoints: string[];
  /** False for questions the vault cannot answer (checks refusals / score floor). */
  answerable: boolean;
}

interface RawGoldenItem {
  id?: unknown;
  question?: unknown;
  expected_sources?: unknown;
  key_points?: unknown;
  answerable?: unknown;
}

export class GoldenFormatError extends Error {}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Parses one JSONL line; blank lines and `//` comments are skipped (returns null). */
export function parseGoldenLine(line: string, lineNumber: number): GoldenItem | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('//')) return null;

  let raw: RawGoldenItem;
  try {
    raw = JSON.parse(trimmed) as RawGoldenItem;
  } catch {
    throw new GoldenFormatError(`line ${lineNumber}: not valid JSON`);
  }
  if (typeof raw.id !== 'string' || !raw.id) throw new GoldenFormatError(`line ${lineNumber}: "id" is required`);
  if (typeof raw.question !== 'string' || !raw.question.trim()) throw new GoldenFormatError(`line ${lineNumber}: "question" is required`);

  const answerable = raw.answerable !== false;
  const expectedSources = raw.expected_sources ?? [];
  if (!isStringArray(expectedSources)) throw new GoldenFormatError(`line ${lineNumber}: "expected_sources" must be a string array`);
  if (answerable && expectedSources.length === 0) {
    throw new GoldenFormatError(`line ${lineNumber}: answerable question needs at least one expected source`);
  }
  const keyPoints = raw.key_points ?? [];
  if (!isStringArray(keyPoints)) throw new GoldenFormatError(`line ${lineNumber}: "key_points" must be a string array`);

  return { id: raw.id, question: raw.question, expectedSources, keyPoints, answerable };
}

export function parseGoldenSet(content: string): GoldenItem[] {
  const items = content.split(/\r?\n/).map((line, i) => parseGoldenLine(line, i + 1)).filter((item): item is GoldenItem => item !== null);
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new GoldenFormatError(`duplicate id "${item.id}"`);
    ids.add(item.id);
  }
  return items;
}
