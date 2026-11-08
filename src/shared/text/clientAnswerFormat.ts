import { MathNormalizeMode } from './enums/text.enums';
import { normalizeMathDelimiters } from './mathNormalizer';
import { sanitizeMermaidFences } from './mermaidSanitizer';
import { fencePlantUmlBlocks } from './plantUml';

/**
 * Final answer text as sent to clients (chat API JSON / stream `done`, Canvas [CFH:REPLY]):
 * bare `@startuml … @enduml` blocks fenced as ```plantuml (before math, which must not touch them),
 * Mermaid fence bodies sanitized, math only as `$…$` / `$$…$$` (strict), other code untouched.
 */
export function formatAnswerForClient(text: string): string {
  return normalizeMathDelimiters(sanitizeMermaidFences(fencePlantUmlBlocks(text)), { mode: MathNormalizeMode.STRICT });
}
