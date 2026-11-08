import { splitCodeSegments } from './codeSegments';
import {
  ANY_START_DIRECTIVE,
  BARE_PLANTUML_BLOCK,
  C4_INCLUDE_LEVEL,
  END_UML,
  END_UML_LINE,
  PLANTUML_FENCE_INFOS,
  PLANTUML_INFO,
  START_UML,
  START_UML_LINE,
} from './constants/plantUml.constants';
import { TextSegmentKind } from './enums/text.enums';

/** Fenced-code ranges [start, end) of a Markdown text (bare blocks inside them are left alone). */
function codeRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let at = 0;
  for (const segment of splitCodeSegments(text)) {
    if (segment.kind !== TextSegmentKind.TEXT) ranges.push([at, at + segment.text.length]);
    at += segment.text.length;
  }
  return ranges;
}

/**
 * Wraps every complete bare `@startuml … @enduml` block (outside code) in a ```plantuml fence,
 * so clients can detect and render it. Fenced blocks and inline code are untouched; idempotent.
 */
export function fencePlantUmlBlocks(text: string): string {
  if (!text.includes(START_UML)) return text;
  const ranges = codeRanges(text);
  const inCode = (index: number) => ranges.some(([start, end]) => index >= start && index < end);
  return text.replace(BARE_PLANTUML_BLOCK, (block: string, offset: number) => {
    if (inCode(offset)) return block;
    const before = offset > 0 && text[offset - 1] !== '\n' ? '\n' : '';
    return `${before}\`\`\`${PLANTUML_INFO}\n${block.trim()}\n\`\`\``;
  });
}

function isPlantUmlFence(info: string, body: string): boolean {
  return PLANTUML_FENCE_INFOS.has(info.split(/\s+/)[0].toLowerCase()) || body.trimStart().startsWith(START_UML);
}

/** The PlantUML sources of an answer: ```plantuml/puml/uml/c4plantuml fences, any fence starting with `@startuml`, and bare blocks. */
export function extractPlantUmlBlocks(text: string): string[] {
  if (!text) return [];
  return splitCodeSegments(fencePlantUmlBlocks(text))
    .filter((s) => s.kind === TextSegmentKind.FENCED_CODE && s.fence && isPlantUmlFence(s.fence.info, s.fence.body))
    .map((s) => s.fence!.body.trim())
    .filter((body) => body.length > 0);
}

/** LF line endings, trimmed, wrapped in `@startuml … @enduml` when the body lacks them. */
export function normalizePlantUmlSource(source: string): string {
  const body = source.replace(/\r\n?/g, '\n').trim();
  if (!ANY_START_DIRECTIVE.test(body)) return `${START_UML}\n${body}\n${END_UML}`;
  if (START_UML_LINE.test(body) && !END_UML_LINE.test(body)) return `${body}\n${END_UML}`;
  return body;
}

/** C4 level from the C4-PlantUML include (`C4_Context|C4_Container|C4_Component`), else undefined. */
export function plantUmlC4Level(source: string): string | undefined {
  const match = C4_INCLUDE_LEVEL.exec(source);
  return match ? match[1].toLowerCase() : undefined;
}
