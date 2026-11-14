import type { CitedChunk } from '../../retrieval';
import { describeConnectivity, type C4Level, type ClarifyQuestion, type ConnectivityReport } from '../domain';
import type { C4RepairInput, C4SkillSource } from './interfaces/c4Sketch.interface';
import { C4SkillId } from './enums/c4Skill.enums';
import {
  C4_SYSTEM_PROMPT,
  CLARIFY_PARSE_INSTRUCTIONS,
  CRITIC_DESIGN_CHECKS,
  DESIGN_READ_INSTRUCTIONS,
  DISCUSSION_INSTRUCTIONS,
  DISCUSSION_SYSTEM_PROMPT,
  EXTRACT_INSTRUCTIONS,
  JSON_RETRY,
  KNOWLEDGE_CLOSE_TAG,
  KNOWLEDGE_OPEN_TAG,
  KNOWLEDGE_RULES,
  LEVEL_RULES,
  LEVEL_SKILLS,
  REVIEW_INSTRUCTIONS,
  REVIEW_SYSTEM_PROMPT,
  REVISE_INSTRUCTIONS,
  SPEC_SHAPE,
  UNIVERSAL_RULES,
} from './constants/c4Prompts.constants';

/** Fallback text of each skill when the prompt registry is off or lacks the file. */
const FALLBACK: Readonly<Record<C4SkillId, string>> = {
  [C4SkillId.SYSTEM]: C4_SYSTEM_PROMPT,
  [C4SkillId.KNOWLEDGE_RULES]: KNOWLEDGE_RULES,
  [C4SkillId.SPEC_SHAPE]: SPEC_SHAPE,
  [C4SkillId.UNIVERSAL_RULES]: UNIVERSAL_RULES,
  [C4SkillId.LEVEL_CONTEXT]: LEVEL_RULES.context,
  [C4SkillId.LEVEL_CONTAINER]: LEVEL_RULES.container,
  [C4SkillId.LEVEL_COMPONENT]: LEVEL_RULES.component,
  [C4SkillId.LEVEL_SEQUENCE]: LEVEL_RULES.sequence,
  [C4SkillId.JSON_RETRY]: JSON_RETRY,
  [C4SkillId.EXTRACT]: EXTRACT_INSTRUCTIONS,
  [C4SkillId.DESIGN_READ]: DESIGN_READ_INSTRUCTIONS,
  [C4SkillId.REVISE]: REVISE_INSTRUCTIONS,
  [C4SkillId.REVIEW_SYSTEM]: REVIEW_SYSTEM_PROMPT,
  [C4SkillId.REVIEW]: REVIEW_INSTRUCTIONS,
  [C4SkillId.CLARIFY_PARSE]: CLARIFY_PARSE_INSTRUCTIONS,
  [C4SkillId.DISCUSSION_SYSTEM]: DISCUSSION_SYSTEM_PROMPT,
  [C4SkillId.DISCUSSION]: DISCUSSION_INSTRUCTIONS,
  [C4SkillId.CRITIC_DESIGN]: CRITIC_DESIGN_CHECKS,
};

/**
 * Prompts of the /api/c4 agents. Static instruction blocks come from the prompt registry
 * (`prompts/skills/c4/*.md`) when it is on, with the TS constants as fallback. Each agent handles every
 * requested level in one call: providers rate-limit and every call costs seconds.
 */
export class C4PromptBuilder {
  /**
   * `sharedRules`: instruction precedence + domain system-architecture from the registry (12/11 02 Bước 4), composed
   * in front of every /c4 system prompt so /c4 and chat share one source of C4 rules. `reminder`: the static
   * `prompts/policies/reminder.md`, appended after each request text.
   */
  constructor(
    private readonly skills: C4SkillSource | null = null,
    private readonly sharedRules: string | null = null,
    private readonly reminder: string = '',
  ) {}

  /** A skill's text: the registry file when present, else the built-in constant. */
  skill(id: C4SkillId): string {
    return this.skills?.(id)?.trim() || FALLBACK[id];
  }

  private levelRules(levels: readonly C4Level[]): string {
    return levels.map((level) => this.skill(LEVEL_SKILLS[level])).join('\n');
  }

  /**
   * The user's vault notes (retrieved once per run, shared by every agent) as reference material: placed in the
   * USER message in front of each request (12/11 02 Bước 3), never in the system role. Empty without notes.
   */
  reference(knowledge: readonly CitedChunk[]): string {
    if (knowledge.length === 0) return '';
    const notes = knowledge.map((chunk, i) => `[${i + 1}] ${chunk.source} > ${chunk.heading}\n${chunk.text}`).join('\n\n');
    return `${KNOWLEDGE_OPEN_TAG}\n${notes}\n${KNOWLEDGE_CLOSE_TAG}\n\n${this.skill(C4SkillId.KNOWLEDGE_RULES)}`;
  }

  /** One request's user text: reference material, the request, then the static reminder. */
  userText(reference: string | undefined, text: string): string {
    return [reference?.trim(), text, this.reminder.trim()].filter(Boolean).join('\n\n');
  }

  private withSharedRules(base: string): string {
    return this.sharedRules?.trim() ? `${this.sharedRules.trim()}\n\n${base}` : base;
  }

  /** Precedence + System Architecture rules + the C4 persona (static: the same for every run). */
  system(): string {
    return this.withSharedRules(this.skill(C4SkillId.SYSTEM));
  }

  /** The evaluator's system prompt (markdown answer), on the same shared rules. */
  reviewSystem(): string {
    return this.withSharedRules(this.skill(C4SkillId.REVIEW_SYSTEM));
  }

  /** The design discussion writer's system prompt (markdown answer), on the same shared rules (plan 04 §5.3). */
  discussionSystem(): string {
    return this.withSharedRules(this.skill(C4SkillId.DISCUSSION_SYSTEM));
  }

  jsonRetry(): string {
    return this.skill(C4SkillId.JSON_RETRY);
  }

  /** Extraction: every image (in order) + the typed text → one brief (+ what the typed text states on its own). */
  extract(typedText: string, imageCount: number): string {
    return `${this.skill(C4SkillId.EXTRACT)}

Images attached: ${imageCount} (indexes 0..${Math.max(0, imageCount - 1)}).
Typed text:
<<<
${typedText.trim() || '(none)'}
>>>`;
  }

  /** Analyst + drafter in one call: requirement checklist and every requested diagram from one shared model. */
  architect(statement: string, levels: readonly C4Level[], maxElements: number, notes?: string): string {
    const keys = levels.join(', ');
    return `Produce the requirement checklist and the C4 diagrams: ${keys}.

Step 1 — requirements: only what the statement asks or clearly implies (actors, features, external integrations, quality
attributes that need an architectural element). Merge duplicates; usually 3-10 items. For each, list the levels (from: ${keys})
where it must be visible: actors/external systems → context (+container); technical building blocks → container; internals of the
main container → component; a runtime flow → sequence.

Step 2 — one consistent model: one element per distinct actor role and per external system that is mentioned or strictly required
(e.g. a payment provider when payment is required). Containers: the fewest deployable units that satisfy the requirements (typically
client app(s), one backend API, one database), plus the infrastructure the container rules call for.

Step 3 — diagrams (at most ${maxElements} non-boundary elements each). Context and container diagrams MUST contain every actor and
external system of the model, with the same id, each connected by a relationship:
${this.levelRules(levels)}

${this.skill(C4SkillId.UNIVERSAL_RULES)}

The problem was already clarified with the user: do not ask questions, return "clarifications": [].

JSON shape:
{ "systemName": "…",
  "requirements": [ { "id": "R1", "text": "…", "levels": ["${levels[0]}"] } ],
  "model": { "actors": [ { "id": "student", "name": "…" } ], "externalSystems": [ { "id": "sso", "name": "…" } ] },
  "clarifications": [],
  "diagrams": { ${levels.map((level) => `"${level}": <spec>`).join(', ')} } }
where each <spec> is:
${this.skill(C4SkillId.SPEC_SHAPE)}

Problem statement:
<<<
${statement}
>>>${notes ? `

The user's answers to the clarification questions (they override the statement):
<<<
${notes}
>>>` : ''}`;
  }

  /** c4_revise: the base spec (chosen by the artifact resolver) + the requested change → the full revised design. */
  revise(baseSpecJson: string, change: string, statement: string, levels: readonly C4Level[], maxElements: number): string {
    return `${this.skill(C4SkillId.REVISE)}

Levels to return: ${levels.join(', ')} (at most ${maxElements} non-boundary elements each).
${this.levelRules(levels)}

${this.skill(C4SkillId.UNIVERSAL_RULES)}

JSON shape (same as a new design):
{ "systemName": "…",
  "requirements": [ { "id": "R1", "text": "…", "levels": ["${levels[0]}"] } ],
  "model": { "actors": [ { "id": "…", "name": "…" } ], "externalSystems": [ { "id": "…", "name": "…" } ] },
  "clarifications": [],
  "diagrams": { ${levels.map((level) => `"${level}": <spec>`).join(', ')} } }
where each <spec> is:
${this.skill(C4SkillId.SPEC_SHAPE)}

Base design (JSON):
${baseSpecJson}

Requested change:
<<<
${change}
>>>${statement ? `

Problem statement (context):
<<<
${statement}
>>>` : ''}`;
  }

  /** Fallback for a level the architect left out. */
  drafter(level: C4Level, statement: string, requirementsJson: string, modelJson: string, maxElements: number): string {
    return `Draft ONE C4 ${level} diagram: the smallest diagram that covers every requirement tagged "${level}"
(at most ${maxElements} non-boundary elements).

${this.levelRules([level])}

${this.skill(C4SkillId.UNIVERSAL_RULES)}

JSON shape:
${this.skill(C4SkillId.SPEC_SHAPE)}

Requirements:
${requirementsJson}

Shared model (reuse these ids; context and container diagrams show every actor and external system):
${modelJson}

Problem statement (the problem images, if any, are attached):
<<<
${statement}
>>>`;
  }

  /** One repair call for every level the validator or PlantUML rejected. */
  repair(broken: ReadonlyMap<C4Level, C4RepairInput>, maxElements: number): string {
    const sections = [...broken].map(([level, { specJson, problems }]) =>
      `### ${level}\n${this.skill(LEVEL_SKILLS[level])}\nProblems:\n${problems.map((p) => `- ${p}`).join('\n')}\nSpec:\n${specJson}`);
    return `Fix these C4 diagram specs. Keep everything that is correct and keep them minimal (at most ${maxElements}
non-boundary elements each). The problem images, if any, are attached for reference.

${sections.join('\n\n')}

Return the full corrected specs (same shape as given):
{ "diagrams": { ${[...broken.keys()].map((level) => `"${level}": <spec>`).join(', ')} } }`;
  }

  /**
   * One critic call; the rendered images are attached in the order of `specs`. `connectivity`: the validator's
   * findings per level (C1–C11, plan 04 §4.2 + 14/11 plan 02), given as facts for checks 5–9.
   */
  critic(specs: ReadonlyMap<C4Level, string>, requirementsJson: string, maxElements: number, connectivity?: ReadonlyMap<C4Level, ConnectivityReport>): string {
    const levels = [...specs.keys()];
    const findings = [...(connectivity ?? new Map<C4Level, ConnectivityReport>())]
      .map(([level, report]) => [level, describeConnectivity([...report.errors, ...report.warnings])] as const)
      .filter(([, lines]) => lines.length > 0)
      .map(([level, lines]) => `### ${level}\n${lines.map((line) => `- ${line}`).join('\n')}`);
    return `Review the rendered C4 diagrams (images attached in this order: ${levels.join(', ')}) that answer an exam problem.
For each diagram check, in order:
1. Coverage: every requirement that applies to its level is clearly visible.
2. Minimality: no element or relationship that no requirement needs; no two elements that mean the same thing.
3. Readability in the image: overlapping or crossing lines, unreadable labels (fix with "dir" hints or shorter text).
4. C4 correctness for the level (right element kinds, technology on containers/components) and the knowledge-base notes.
${this.skill(C4SkillId.CRITIC_DESIGN)}

Only revise for a real problem. Always list what you checked and found in "issues" (short, readable sentences in the
language of the requirements), also for an "ok" verdict. JSON shape:
{ "levels": { ${levels.map((level) => `"${level}": <verdict>`).join(', ')} } }
where <verdict> is {"verdict":"ok", "issues":["…"]} or {"verdict":"revise", "issues":["…"], "spec": <full corrected spec, same shape,
at most ${maxElements} non-boundary elements>}.

Requirements:
${requirementsJson}

Connectivity warnings (validator):
${findings.length ? findings.join('\n') : '(none)'}

${[...specs].map(([level, json]) => `### ${level} spec\n${json}`).join('\n\n')}`;
  }

  /**
   * The design discussion request (plan 04 §5.3): the problem brief, the final specs (with instances) and the
   * connectivity findings left after repair/critic, under the fixed seven-topic frame.
   */
  discussion(briefText: string, specsJson: string, warnings: readonly string[]): string {
    return `${this.skill(C4SkillId.DISCUSSION)}

Problem (brief):
<<<
${briefText || '(no statement given)'}
>>>

Connectivity warnings (validator):
${warnings.length ? warnings.map((w) => `- ${w}`).join('\n') : '(none)'}

Design (final specs, JSON):
${specsJson}`;
  }

  /** The user's design image(s) → specs, transcribed as drawn. */
  designRead(): string {
    return `${this.skill(C4SkillId.DESIGN_READ)}\n${this.skill(C4SkillId.SPEC_SHAPE)}`;
  }

  /** The evaluator's request: problem brief + the design (specs) + its source. */
  review(briefText: string, designJson: string, designLabel: string): string {
    return `${this.skill(C4SkillId.REVIEW)}

Problem (brief):
<<<
${briefText || '(no statement given: judge the C4 notation and internal consistency only)'}
>>>

Design under review — ${designLabel} (JSON transcription; images attached when available):
${designJson}`;
  }

  /** The aux model's request: questions (slot ids) + the user's reply. */
  clarifyParse(questions: readonly ClarifyQuestion[], reply: string): string {
    return `${this.skill(C4SkillId.CLARIFY_PARSE)}

Questions:
${questions.map((q, i) => `${i + 1}. [${q.slot}] ${q.question} (default: ${q.default})`).join('\n')}

Reply:
<<<
${reply}
>>>`;
  }
}
