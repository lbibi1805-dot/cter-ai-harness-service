import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience';
import { extractJsonObject } from '../../../shared/text';
import {
  BriefSource,
  C4Slot,
  emptyBrief,
  isAcceptAll,
  mergeBrief,
  parseNumberedAnswers,
  toBriefOverride,
  toProblemBrief,
  withRequestedLevels,
  type ClarifyQuestion,
  type ProblemBrief,
  type SlotAnswers,
} from '../domain';
import { CLARIFY_PARSE_MAX_OUTPUT_TOKENS } from './constants/c4Prompts.constants';
import { C4Step, CLARIFY_PARSE_LABEL, CLARIFY_PARSE_SYSTEM, CLARIFY_PARSE_TIMEOUT_MS } from './constants/c4Sketch.constants';
import type { C4ModelCaller } from './c4ModelCaller';
import type { C4PromptBuilder } from './c4Prompts.builder';
import type { C4AuxGateway, C4RunContext, C4SketchRequest } from './interfaces/c4Sketch.interface';

const SLOTS = new Set<string>(Object.values(C4Slot));

/** Extraction (note 05 §4) and the clarify-reply parser (§5 rule 3). */
export class C4BriefService {
  constructor(
    private readonly calls: C4ModelCaller,
    private readonly prompts: C4PromptBuilder,
    private readonly aux: C4AuxGateway | null,
  ) {}

  /**
   * One structured call over every image (multi-page statement → one brief) and the typed text; the typed
   * text's own fields are merged over it (typed text wins), then the levels the client asked for. A failed
   * call gives an empty brief built from the typed text only — the run goes on.
   */
  async extract(ctx: C4RunContext, request: C4SketchRequest): Promise<ProblemBrief> {
    const raw = await attempt(() => this.calls.askJson(ctx, this.prompts.extract(request.description, request.images.length), request.images, C4Step.EXTRACT));
    if (!raw.ok) logger.warn(`[c4] ${ctx.label} extraction failed: ${errorMessage(raw.error)} — continuing from the typed text`);
    const body = raw.ok ? raw.value : undefined;
    const nested = body?.brief && typeof body.brief === 'object' ? (body.brief as Record<string, unknown>) : body;
    const source = request.images.length > 0 ? BriefSource.IMAGE : BriefSource.TEXT;
    const brief = nested ? toProblemBrief(nested, source, request.images.length) : emptyBrief();
    const typed = body?.typed && typeof body.typed === 'object' && request.description.trim() ? toBriefOverride(body.typed as Record<string, unknown>) : {};
    return withRequestedLevels(mergeBrief(brief, typed), request.levels);
  }

  /**
   * Slot answers from a free-text reply: "ok"/blank = all defaults (no call); otherwise the aux model maps
   * the reply to the slots; without it (or when it fails) numbered answers ("1. …") or a single question.
   */
  async parseReply(reply: string | undefined, questions: readonly ClarifyQuestion[]): Promise<SlotAnswers> {
    if (isAcceptAll(reply) || questions.length === 0) return {};
    const text = reply!.trim();
    if (this.aux) {
      const parsed = await attempt(() => this.aux!.complete({
        system: CLARIFY_PARSE_SYSTEM,
        text: this.prompts.clarifyParse(questions, text),
        label: CLARIFY_PARSE_LABEL,
        timeoutMs: CLARIFY_PARSE_TIMEOUT_MS,
        maxOutputTokens: CLARIFY_PARSE_MAX_OUTPUT_TOKENS,
      }));
      const answers = parsed.ok ? toSlotAnswers(parsed.value, questions) : null;
      if (!parsed.ok) logger.warn(`[c4] clarify reply parse failed (${errorMessage(parsed.error)}) — numbered answers / defaults`);
      if (answers) return answers;
    }
    return parseNumberedAnswers(text, questions) ?? {};
  }
}

/** The aux JSON `{"answers": {"<slot>": "…"}}`, restricted to the asked slots; null when unusable. */
export function toSlotAnswers(answer: string, questions: readonly ClarifyQuestion[]): SlotAnswers | null {
  const json = extractJsonObject(answer);
  const raw = json?.answers;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const asked = new Set<string>(questions.map((q) => q.slot));
  const answers: SlotAnswers = {};
  for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SLOTS.has(slot) && asked.has(slot) && typeof value === 'string' && value.trim()) answers[slot as C4Slot] = value.trim();
  }
  return answers;
}
