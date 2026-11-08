import * as fs from 'fs';
import * as path from 'path';
import { CORE_PROMPT_PATH, PATH_SEPARATOR, PROMPT_FILE_EXTENSION } from '../domain/constants/prompt.constants';
import type { RawPromptFile } from '../domain/interfaces/prompt.interface';

/** True when `rootDir` holds a registry (its core prompt exists). */
export function hasPromptRegistry(rootDir: string): boolean {
  return fs.existsSync(path.join(rootDir, CORE_PROMPT_PATH));
}

/** Every `.md` under `rootDir` (recursive), with `/`-separated relative paths, sorted for a stable order. */
export function readPromptFiles(rootDir: string): RawPromptFile[] {
  const files: RawPromptFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(PROMPT_FILE_EXTENSION)) {
        files.push({
          path: path.relative(rootDir, absolute).split(path.sep).join(PATH_SEPARATOR),
          content: fs.readFileSync(absolute, 'utf-8'),
        });
      }
    }
  };
  walk(rootDir);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
