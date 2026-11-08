import { describe, expect, it } from 'vitest';
import { extractPlantUmlBlocks, fencePlantUmlBlocks, formatAnswerForClient, normalizePlantUmlSource, plantUmlC4Level } from '../../../../src/shared/text';

const C4 = [
  '@startuml',
  '!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml',
  'Container_Boundary(api, "API") {',
  '  Component(auth, "Auth", "Spring")',
  '}',
  'Rel(auth, db, "reads $price")',
  '@enduml',
].join('\n');

const FENCE = '```';

describe('fencePlantUmlBlocks', () => {
  it('wraps a bare @startuml … @enduml block in a plantuml fence', () => {
    const out = fencePlantUmlBlocks(`Đã sửa:\n\n${C4}\n\n- thêm Auth`);
    expect(out).toBe(`Đã sửa:\n\n${FENCE}plantuml\n${C4}\n${FENCE}\n\n- thêm Auth`);
  });

  it('leaves fenced blocks alone and is idempotent', () => {
    const fenced = `${FENCE}puml\n${C4}\n${FENCE}`;
    expect(fencePlantUmlBlocks(fenced)).toBe(fenced);
    const once = fencePlantUmlBlocks(C4);
    expect(fencePlantUmlBlocks(once)).toBe(once);
    const plain = `${FENCE}\n${C4}\n${FENCE}`;
    expect(fencePlantUmlBlocks(plain)).toBe(plain);
  });

  it('ignores an unfinished block and text without @startuml', () => {
    expect(fencePlantUmlBlocks('@startuml\nA -> B')).toBe('@startuml\nA -> B');
    expect(fencePlantUmlBlocks('no diagram')).toBe('no diagram');
  });

  it('wraps several bare blocks', () => {
    const out = fencePlantUmlBlocks(`${C4}\n\nvà\n\n@startuml\nA -> B\n@enduml`);
    expect(out.match(/```plantuml/g)).toHaveLength(2);
  });
});

describe('formatAnswerForClient', () => {
  it('fences bare PlantUML before math normalization (no $ rewriting inside)', () => {
    const out = formatAnswerForClient(C4);
    expect(out).toContain(`${FENCE}plantuml\n@startuml`);
    expect(out).toContain('reads $price');
  });
});

describe('extractPlantUmlBlocks', () => {
  it('finds plantuml/puml/uml/c4plantuml fences, @startuml fences and bare blocks', () => {
    const text = [
      `${FENCE}plantuml\nA -> B\n${FENCE}`,
      `${FENCE}c4plantuml\n@startuml\nC -> D\n@enduml\n${FENCE}`,
      `${FENCE}text\n@startuml\nE -> F\n@enduml\n${FENCE}`,
      `${FENCE}python\nprint(1)\n${FENCE}`,
      '@startuml\nG -> H\n@enduml',
    ].join('\n\n');
    expect(extractPlantUmlBlocks(text)).toEqual([
      'A -> B',
      '@startuml\nC -> D\n@enduml',
      '@startuml\nE -> F\n@enduml',
      '@startuml\nG -> H\n@enduml',
    ]);
    expect(extractPlantUmlBlocks('')).toEqual([]);
  });
});

describe('normalizePlantUmlSource / plantUmlC4Level', () => {
  it('wraps a body without @startuml/@enduml, completes a missing @enduml, normalizes CRLF', () => {
    expect(normalizePlantUmlSource('  A -> B  ')).toBe('@startuml\nA -> B\n@enduml');
    expect(normalizePlantUmlSource('@startuml\r\nA -> B')).toBe('@startuml\nA -> B\n@enduml');
    expect(normalizePlantUmlSource('@startuml\r\nA -> B\r\n@enduml\r\n')).toBe('@startuml\nA -> B\n@enduml');
    expect(normalizePlantUmlSource('@startmindmap\n* a\n@endmindmap')).toBe('@startmindmap\n* a\n@endmindmap');
  });

  it('infers the C4 level from the include', () => {
    expect(plantUmlC4Level(C4)).toBe('component');
    expect(plantUmlC4Level('!include <C4/C4_Container>')).toBe('container');
    expect(plantUmlC4Level('!include C4_Context.puml')).toBe('context');
    expect(plantUmlC4Level('A -> B')).toBeUndefined();
  });
});
