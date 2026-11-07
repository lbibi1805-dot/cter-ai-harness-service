import { MathNormalizeMode } from './enums/text.enums';
import { normalizeMathDelimiters } from './mathNormalizer';
import { sanitizeMermaidFences } from './mermaidSanitizer';

/**
 * Final answer text as sent to clients (chat API JSON / stream `done`, Canvas [CFH:REPLY]):
 * Mermaid fence bodies sanitized, math only as `$…$` / `$$…$$` (strict), other code untouched.
 */
export function formatAnswerForClient(text: string): string {
  return normalizeMathDelimiters(sanitizeMermaidFences(text), { mode: MathNormalizeMode.STRICT });
}
