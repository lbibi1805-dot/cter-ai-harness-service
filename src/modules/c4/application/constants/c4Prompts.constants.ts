import { C4Level } from '../../domain';
import { C4SkillId } from '../enums/c4Skill.enums';

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

export const LEVEL_SKILLS: Readonly<Record<C4Level, C4SkillId>> = {
  [C4Level.CONTEXT]: C4SkillId.LEVEL_CONTEXT,
  [C4Level.CONTAINER]: C4SkillId.LEVEL_CONTAINER,
  [C4Level.COMPONENT]: C4SkillId.LEVEL_COMPONENT,
  [C4Level.SEQUENCE]: C4SkillId.LEVEL_SEQUENCE,
};

/** Extraction (note 05 §4): every image + the typed text → one ProblemBrief, typed text kept apart so it can override. */
export const EXTRACT_INSTRUCTIONS = `
Read the problem statement of an exam question about software architecture (C4 model). It is given as images (photos
or screenshots of one or more pages, in order — together they are ONE problem) and/or text typed by the user.
Some images may instead show the user's OWN design (a diagram they drew); report those in "userDesign" and do not
read requirements from them.

Return ONE JSON object:
{ "brief": <brief from everything>, "typed": <brief with ONLY what the typed text states, {} when there is no typed text> }
where <brief> is:
{ "systemName": {"value": "…", "confidence": 0.0},
  "systemBoundary": {"value": "what is inside the system to design", "confidence": 0.0},
  "actors": {"value": ["…"], "confidence": 0.0},
  "externalSystems": {"value": ["…"], "confidence": 0.0},
  "functionalReqs": ["…"], "nonFunctionalReqs": ["…"],
  "techConstraints": {"value": ["…"], "confidence": 0.0},
  "levels": {"value": ["context", "container"], "confidence": 0.0},
  "rubric": [ {"criterion": "…", "weight": 1} ],
  "userDesign": {"present": false, "imageIndexes": []} }
Rules: confidence 0..1 = how clearly the statement says it (0 = not stated at all, guessed). "levels" = the C4 levels
the question asks to draw (context, container, component, sequence); leave [] with confidence 0 when it does not say.
"externalSystems": [] with a high confidence only when the statement clearly has none. imageIndexes are 0-based.
Write values in the language of the statement; requirements short (under 15 words each); do not invent requirements.
`.trim();

/** Reading the user's own design image into specs (review of a user design, note 05 §6). */
export const DESIGN_READ_INSTRUCTIONS = `
The attached image(s) show a C4 design drawn by a student. Transcribe it faithfully into specs — do not fix, complete
or improve it: keep wrong element kinds, missing technology and odd relationships exactly as drawn, so it can be marked.
Return ONE JSON object: { "systemName": "…", "diagrams": { "<level>": <spec> } } with <level> one of context, container,
component, sequence (one entry per diagram in the images) and each <spec> in this shape (covers may stay empty):
`.trim();

/** c4_revise: change a base spec as the user asks (note 05 §2 / 17 §4). */
export const REVISE_INSTRUCTIONS = `
Revise an existing C4 design as the user asks. Keep every element, id and relationship that the change does not touch;
apply exactly the requested change (and only the minimal follow-up edits it needs on other levels to stay consistent).
`.trim();

/** System prompt of the evaluator: it answers in markdown (the JSON rule of the C4 system prompt does not apply). */
export const REVIEW_SYSTEM_PROMPT = `
You are a strict but fair examiner of software architecture (C4 model) answers. You mark a design against the problem
statement, the marking rubric and the C4 notation rules, and you explain in the language of the problem statement
(Vietnamese unless the statement is in another language). You answer in markdown only.
`.trim();

/** The evaluator's fixed frame (note 05 §6). */
export const REVIEW_INSTRUCTIONS = `
Evaluate the design below. Use EXACTLY these sections, in this order, with these headings:
## Tóm tắt nhận xét
(2-4 sentences: overall verdict and the most important problem)
## Đánh giá theo tiêu chí
| Tiêu chí | Điểm | Nhận xét |
|---|---|---|
(one row per rubric criterion; score as "x/10"; the rubric comes from the problem, else the knowledge base, else the
standard C4 rubric: requirement coverage, correct C4 notation per level, consistency between levels, minimality/clarity,
technology choices)
## Yêu cầu chưa đáp ứng
(bullets: requirements of the problem the design does not show; "- Không có" when none)
## Lỗi ký hiệu C4
(bullets: wrong element kinds, missing technology on containers/components, unlabeled relationships, mixed levels…)
## Đề xuất sửa (ưu tiên)
(numbered list, most important first, each concrete enough to apply)
Judge only what is in the design; never invent elements it does not have.
`.trim();

/** Mapping a free-text reply to the clarify questions (aux model, note 05 §5 rule 3). */
export const CLARIFY_PARSE_INSTRUCTIONS = `
The user answered clarification questions about a C4 design task in free text. Map the reply to the questions.
Return ONE JSON object only: {"answers": {"<slot>": "<the user's answer for that slot, short>"}}
Include only slots the reply actually answers; a slot the reply does not mention is left out (its default is used).
"ok", "đồng ý", "giữ mặc định" for everything → {"answers": {}}.
`.trim();

/** Tiny JSON answer of the clarify parser. */
export const CLARIFY_PARSE_MAX_OUTPUT_TOKENS = 400;

/** Third retrieval query of a review: the marking rubric in the knowledge base. */
export const REVIEW_RUBRIC_QUERY = 'C4 architecture design marking rubric, grading criteria, common notation mistakes';
