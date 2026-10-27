import type { CitedChunk } from '../../retrieval';
import type { C4Level } from '../domain';
import type { C4RepairInput } from './interfaces/c4Sketch.interface';
import {
  C4_SYSTEM_PROMPT,
  KNOWLEDGE_CLOSE_TAG,
  KNOWLEDGE_OPEN_TAG,
  KNOWLEDGE_RULES,
  LEVEL_RULES,
  SPEC_SHAPE,
  UNIVERSAL_RULES,
} from './constants/c4Prompts.constants';

/**
 * Prompts of the /api/c4 agents. Each agent handles every requested level in one call: providers
 * rate-limit and every call costs seconds, so few calls is what keeps a run under five minutes.
 */
export class C4PromptBuilder {
  /** C4 persona + the user's knowledge-base notes (retrieved once per run, shared by every agent). */
  system(knowledge: readonly CitedChunk[]): string {
    if (knowledge.length === 0) return C4_SYSTEM_PROMPT;
    const notes = knowledge.map((chunk, i) => `[${i + 1}] ${chunk.source} > ${chunk.heading}\n${chunk.text}`).join('\n\n');
    return `${C4_SYSTEM_PROMPT}\n\n${KNOWLEDGE_OPEN_TAG}\n${notes}\n${KNOWLEDGE_CLOSE_TAG}\n\n${KNOWLEDGE_RULES}`;
  }

  /** Analyst + drafter in one call: requirement checklist and every requested diagram from one shared model. */
  architect(description: string, levels: readonly C4Level[], maxElements: number): string {
    const keys = levels.join(', ');
    return `Produce the requirement checklist and the C4 diagrams: ${keys}.

Step 1 — requirements: only what the statement asks or clearly implies (actors, features, external integrations, quality
attributes that need an architectural element). Merge duplicates; usually 3-10 items. For each, list the levels (from: ${keys})
where it must be visible: actors/external systems → context (+container); technical building blocks → container; internals of the
main container → component; a runtime flow → sequence.

Step 2 — one consistent model: one element per distinct actor role and per external system that is mentioned or strictly required
(e.g. a payment provider when payment is required). Containers: the fewest deployable units that satisfy the requirements (typically
client app(s), one backend API, one database); add queue/cache/worker/storage only when a requirement needs it.

Step 3 — diagrams (at most ${maxElements} non-boundary elements each). Context and container diagrams MUST contain every actor and
external system of the model, with the same id, each connected by a relationship:
${levels.map((level) => LEVEL_RULES[level]).join('\n')}

${UNIVERSAL_RULES}

JSON shape:
{ "systemName": "…",
  "requirements": [ { "id": "R1", "text": "…", "levels": ["${levels[0]}"] } ],
  "model": { "actors": [ { "id": "student", "name": "…" } ], "externalSystems": [ { "id": "sso", "name": "…" } ] },
  "diagrams": { ${levels.map((level) => `"${level}": <spec>`).join(', ')} } }
where each <spec> is:
${SPEC_SHAPE}

Problem statement:
<<<
${description}
>>>`;
  }

  /** Fallback for a level the architect left out. */
  drafter(level: C4Level, description: string, requirementsJson: string, modelJson: string, maxElements: number): string {
    return `Draft ONE C4 ${level} diagram: the smallest diagram that covers every requirement tagged "${level}"
(at most ${maxElements} non-boundary elements).

${LEVEL_RULES[level]}

${UNIVERSAL_RULES}

JSON shape:
${SPEC_SHAPE}

Requirements:
${requirementsJson}

Shared model (reuse these ids; context and container diagrams show every actor and external system):
${modelJson}

Problem statement:
<<<
${description}
>>>`;
  }

  /** One repair call for every level the validator or PlantUML rejected. */
  repair(broken: ReadonlyMap<C4Level, C4RepairInput>, maxElements: number): string {
    const sections = [...broken].map(([level, { specJson, problems }]) =>
      `### ${level}\n${LEVEL_RULES[level]}\nProblems:\n${problems.map((p) => `- ${p}`).join('\n')}\nSpec:\n${specJson}`);
    return `Fix these C4 diagram specs. Keep everything that is correct and keep them minimal (at most ${maxElements}
non-boundary elements each).

${sections.join('\n\n')}

Return the full corrected specs (same shape as given):
{ "diagrams": { ${[...broken.keys()].map((level) => `"${level}": <spec>`).join(', ')} } }`;
  }

  /** One critic call; the rendered images are attached in the order of `specs`. */
  critic(specs: ReadonlyMap<C4Level, string>, requirementsJson: string, maxElements: number): string {
    const levels = [...specs.keys()];
    return `Review the rendered C4 diagrams (images attached in this order: ${levels.join(', ')}) that answer an exam problem.
For each diagram check, in order:
1. Coverage: every requirement that applies to its level is clearly visible.
2. Minimality: no element or relationship that no requirement needs; no two elements that mean the same thing.
3. Readability in the image: overlapping or crossing lines, unreadable labels (fix with "dir" hints or shorter text).
4. C4 correctness for the level (right element kinds, technology on containers/components) and the knowledge-base notes.

Only revise for a real problem. JSON shape:
{ "levels": { ${levels.map((level) => `"${level}": <verdict>`).join(', ')} } }
where <verdict> is {"verdict":"ok"} or {"verdict":"revise", "issues":["…"], "spec": <full corrected spec, same shape,
at most ${maxElements} non-boundary elements>}.

Requirements:
${requirementsJson}

${[...specs].map(([level, json]) => `### ${level} spec\n${json}`).join('\n\n')}`;
  }
}
