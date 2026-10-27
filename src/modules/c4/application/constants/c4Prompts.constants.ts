import { C4Level } from '../../domain';

/**
 * System prompt for every /api/c4 call (replaces the chat persona and its citation rules, which would ask for
 * prose + References instead of JSON). Rules come from the c4-diagrams skill of c4-plantuml-mcp-server.
 */
export const C4_SYSTEM_PROMPT = `
You are a senior software architect producing C4 model diagrams (rendered with C4-PlantUML) for an exam answer.
The goal is always the SMALLEST set of elements and relationships that still covers every requirement of the problem
statement: no decoration, no invented scope, no duplicate elements that mean the same thing.
You always answer with ONE JSON object only (no prose, no markdown outside an optional \`\`\`json fence).
Write names, descriptions and labels in the same language as the problem statement; descriptions under 12 words,
labels under 6 words.
`.trim();

export const KNOWLEDGE_OPEN_TAG = '[KNOWLEDGE BASE]';

export const KNOWLEDGE_CLOSE_TAG = '[/KNOWLEDGE BASE]';

/** Placed after the knowledge chunks: they are the user's own design rules and exam notes. */
export const KNOWLEDGE_RULES = `
The knowledge base above holds the user's design rules, conventions and exam marking notes. Apply every note that is
relevant to architecture/C4 design; such notes override the default rules in the request, except the JSON output
format. Ignore unrelated notes.
`.trim();

/** Second retrieval query, so uploaded design rules are found even when the statement does not mention them. */
export const DESIGN_RULES_QUERY = 'C4 model architecture diagram design rules, conventions and exam notes';

/** Chunks from both queries together; enough for a rule sheet without crowding the request. */
export const MAX_KNOWLEDGE_CHUNKS = 8;

export const SPEC_SHAPE = `
{ "title": "…",
  "elements": [ { "id": "…", "kind": "person|system|container|component|system_boundary|container_boundary",
                  "variant": "standard|db|queue", "external": false, "name": "…", "tech": "…", "desc": "…",
                  "parent": "boundary id or null", "covers": ["R1"] } ],
  "rels": [ { "from": "…", "to": "…", "label": "…", "tech": "…", "dir": "D|U|L|R", "phase": "sequence only", "covers": ["R2"] } ] }
`.trim();

export const UNIVERSAL_RULES = `
Rules for every diagram:
- ids: lower_snake_case ASCII (letters, digits, _), unique within a diagram; reuse the same id for the same thing across diagrams.
- Every element and relationship lists in "covers" the requirement ids it demonstrates. An element with empty "covers" must still
  be an endpoint of a relationship that covers something; otherwise leave it out.
- Every relationship has a short verb label; add "tech" (protocol) at container/component level.
- Containers and components ALWAYS have "tech". People always have external=false.
- "dir" is a layout hint: "D" from people to the system, "R" towards external systems, "D" towards databases.
  Use it to avoid crossing lines; omit when unsure.
`.trim();

export const LEVEL_RULES: Readonly<Record<C4Level, string>> = {
  [C4Level.CONTEXT]: `[context] Exactly one in-scope "system" (external=false) for the system being designed; "person" per actor role;
  "system" with external=true per external system. No containers, components or boundaries.`,
  [C4Level.CONTAINER]: `[container] One "system_boundary" for the system; its containers have "parent" = that boundary id. People and external
  systems stay outside (no parent). Databases: kind "container" + variant "db"; brokers: variant "queue". No components.`,
  [C4Level.COMPONENT]: `[component] One "container_boundary" for the most important container (usually the backend API); its components have
  "parent" = that boundary id. Components only for responsibilities a requirement needs (controller/service per feature area, repository,
  gateway client). Neighbouring containers, people or external systems stay outside.`,
  [C4Level.SEQUENCE]: `[sequence] The single most important end-to-end flow. Participants are a FLAT list: no boundaries, no parent,
  external=false. Relationships are messages in time order (array order = top to bottom); include a reply only when it carries meaning;
  optional "phase" groups consecutive messages under a step heading. About 12 messages at most.`,
};

export const JSON_RETRY = 'Your previous answer could not be parsed as the requested JSON object. Answer again with the JSON object only.';
