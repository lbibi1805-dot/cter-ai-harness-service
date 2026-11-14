/** Latency entry `kind` of a repair call. */
export const DIAGRAM_REPAIR_PURPOSE = 'diagram-repair';

/** A C4 diagram fits easily; caps a runaway answer. */
export const DIAGRAM_REPAIR_MAX_OUTPUT_TOKENS = 4_000;

/** Request text before the error and the block (the rules themselves come from the system prompt). */
export const DIAGRAM_REPAIR_INSTRUCTIONS = 'The PlantUML block below fails a check: it does not render, or it has a connectivity error (ORPHAN_ELEMENT, DISCONNECTED_GRAPH, QUEUE_ONE_SIDED). Fix the reported problem and every other violation of the diagram syntax and connectivity rules, keeping the same elements, relationships and labels; for a connectivity error add the missing relationship with direction and purpose in the label. Answer with the complete corrected source in exactly one ```plantuml block (from @startuml to @enduml) and nothing else.';
