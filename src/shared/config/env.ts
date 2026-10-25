import { ConfigurationError } from '../errors';

/**
 * Typed readers for environment variables. Each falls back to the given
 * default when the variable is unset or blank, and throws ConfigurationError
 * when it is set to something unusable, so a typo fails at startup.
 */
export function readString(name: string, fallback: string): string {
  return readOptionalString(name) ?? fallback;
}

/** Blank values count as unset, matching the `process.env.X || undefined` convention. */
export function readOptionalString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function readInt(name: string, fallback: number): number {
  const raw = readOptionalString(name);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) throw new ConfigurationError(`${name} must be an integer, got "${raw}"`);
  return value;
}

export function readBoolean(name: string, fallback: boolean): boolean {
  const raw = readOptionalString(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new ConfigurationError(`${name} must be "true" or "false", got "${raw}"`);
}

/** Comma-separated list; empty entries are dropped. */
export function readList(name: string, fallback: readonly string[]): string[] {
  const raw = readOptionalString(name);
  if (raw === undefined) return [...fallback];
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export function readEnum<E extends string>(name: string, values: Record<string, E>, fallback: E): E {
  const raw = readOptionalString(name);
  if (raw === undefined) return fallback;
  const allowed = Object.values(values);
  const match = allowed.find((value) => value === raw.toLowerCase() || value === raw);
  if (!match) throw new ConfigurationError(`${name} must be one of ${allowed.join(', ')}, got "${raw}"`);
  return match;
}
