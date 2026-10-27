import { C4Level, isBoundary, type C4DiagramSpec } from '../domain';
import { C4_INCLUDE_FILE, DEFAULT_C4_INCLUDE_BASE, PLAIN_REL_MACRO, REL_MACRO, STDLIB_INCLUDE, TRAILING_SLASHES } from './constants/c4Puml.constants';
import { addElements, elementLine, oneLine, quote } from './helpers/c4Puml.helper';
import type { C4PumlOptions } from './interfaces/c4Sketch.interface';

/**
 * Spec → PlantUML source. Port of generatePlantUMLSource / processElements / addRelationships /
 * getElementMacro from c4-plantuml-mcp-server (src/plantuml-utils), keeping its includes and macros so the
 * images look the same, with fixes: quotes escaped, nested boundaries, Rel_U/D/L/R from the layout hint,
 * HIDE_STEREOTYPE kept, and no ExistingProject note (it printed UUIDs on the image).
 * Expects a spec that went through validateDiagram (ids sanitised, sequence flattened).
 */
export class C4PumlBuilder {
  constructor(private readonly options: C4PumlOptions = {}) {}

  build(spec: C4DiagramSpec, level: C4Level): string {
    const lines = ['@startuml', this.include(level), 'HIDE_STEREOTYPE()', '', `title ${oneLine(spec.title)}`, ''];
    const declared = new Set<string>();
    if (level === C4Level.SEQUENCE) {
      for (const e of spec.elements.filter((el) => !isBoundary(el.kind))) {
        lines.push(elementLine(e, true));
        declared.add(e.id);
      }
    } else {
      addElements(spec.elements, undefined, '', lines, declared, new Set());
    }
    lines.push('');

    let phase: string | undefined;
    for (const rel of spec.rels) {
      if (!declared.has(rel.from) || !declared.has(rel.to)) continue;
      if (level === C4Level.SEQUENCE && rel.phase && rel.phase !== phase) {
        phase = rel.phase;
        lines.push(`== ${oneLine(phase)} ==`);
      }
      const macro = level === C4Level.SEQUENCE || !rel.dir ? PLAIN_REL_MACRO : REL_MACRO[rel.dir];
      const tech = rel.tech ? `, "${quote(rel.tech)}"` : '';
      lines.push(`${macro}(${rel.from}, ${rel.to}, "${quote(rel.label)}"${tech})`);
    }

    if (this.options.showLegend && level !== C4Level.SEQUENCE) lines.push('', 'SHOW_LEGEND()');
    lines.push('@enduml');
    return lines.join('\n');
  }

  include(level: C4Level): string {
    const base = (this.options.includeBase ?? DEFAULT_C4_INCLUDE_BASE).replace(TRAILING_SLASHES, '');
    const file = C4_INCLUDE_FILE[level];
    return base.toLowerCase() === STDLIB_INCLUDE ? `!include <C4/${file}>` : `!include ${base}/${file}.puml`;
  }
}
