import * as fs from 'fs';
import * as path from 'path';
import type { AIProvider } from '../../modules/ai';

/** `CLAUDE` for `claude`: the per-provider env variable suffix (CLAUDE_API_KEY, DEFAULT_MODEL_CLAUDE…). */
export function envSuffix(provider: AIProvider): string {
  return provider.toUpperCase();
}

/** Contents of a project file (trimmed), or '' when it does not exist. */
export function readProjectFile(fileName: string): string {
  const absolute = path.resolve(process.cwd(), fileName);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf-8').trim() : '';
}
