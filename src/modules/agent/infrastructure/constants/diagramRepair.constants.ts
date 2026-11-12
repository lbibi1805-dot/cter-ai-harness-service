/** Latency entry `kind` of a repair call. */
export const DIAGRAM_REPAIR_PURPOSE = 'diagram-repair';

/** A C4 diagram fits easily; caps a runaway answer. */
export const DIAGRAM_REPAIR_MAX_OUTPUT_TOKENS = 4_000;

/** Request text before the error and the block (the rules themselves come from the system prompt). */
export const DIAGRAM_REPAIR_INSTRUCTIONS = 'The PlantUML block below does not render. Fix the reported syntax error and every other violation of the diagram syntax rules, keeping the same elements, relationships and labels. Answer with the complete corrected source in exactly one ```plantuml block (from @startuml to @enduml) and nothing else.';
