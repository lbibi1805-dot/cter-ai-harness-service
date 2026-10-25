import { InvalidToolArgumentsError } from '../../domain';

export function parseArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new InvalidToolArgumentsError('tool arguments must be a JSON object');
  return parsed as Record<string, unknown>;
}
