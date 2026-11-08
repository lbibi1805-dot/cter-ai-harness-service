/** Info strings (first word, lower-cased) of a fence that holds PlantUML. */
export const PLANTUML_FENCE_INFOS: ReadonlySet<string> = new Set(['plantuml', 'puml', 'uml', 'c4plantuml']);

/** Info string used when a bare `@startuml … @enduml` block is wrapped in a fence. */
export const PLANTUML_INFO = 'plantuml';

/** A complete bare block: `@startuml` at a line start up to the first `@enduml` line (multiline flag). */
export const BARE_PLANTUML_BLOCK = /^[ \t]*@startuml\b[^\n]*\n[\s\S]*?^[ \t]*@enduml[ \t]*$/gm;

export const START_UML = '@startuml';
export const END_UML = '@enduml';
/** Any PlantUML start directive (`@startuml`, `@startmindmap`, …). */
export const ANY_START_DIRECTIVE = /^[ \t]*@start\w+/m;
export const START_UML_LINE = /^[ \t]*@startuml\b/m;
export const END_UML_LINE = /^[ \t]*@enduml\b/m;

/** C4-PlantUML include (URL or stdlib) → C4 level. */
export const C4_INCLUDE_LEVEL = /C4_(Context|Container|Component)\b/;
