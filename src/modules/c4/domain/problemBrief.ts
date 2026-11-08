import {
  ACCEPT_ALL_ANSWERS,
  CLARIFY_MIN_CONFIDENCE,
  DEFAULT_ACCEPTED_CONFIDENCE,
  IMPACT_RANK,
  LEVEL_ANSWER_WORDS,
  LIST_ANSWER_SEPARATOR,
  MAX_CLARIFY_QUESTIONS,
  MAX_SUMMARY_BULLETS,
  NONE_ANSWERS,
  NUMBERED_ANSWER,
  SLOT_RULES,
  SUMMARY_MAX_REQUIREMENTS,
  SlotDefaults,
  SummaryLabels,
  TRAILING_PUNCTUATION,
  UNSTATED_CONFIDENCE,
  USER_STATED_CONFIDENCE,
} from './constants/problemBrief.constants';
import { C4_LEVEL_ALIASES, C4_LEVEL_ORDER, DEFAULT_C4_LEVELS } from './constants/c4.constants';
import { BriefSource, C4Slot, ClarifySkipReason, SlotImpact, type C4Level } from './enums/c4.enums';
import type {
  BriefField,
  BriefOverride,
  BriefRubricItem,
  ClarifyQuestion,
  GapAnalysis,
  GapAnalysisOptions,
  ProblemBrief,
  SlotAnswers,
} from './interfaces/problemBrief.interface';

// ── parsing ────────────────────────────────────────────────────────────────

function field<T>(value: T, confidence: number, source: BriefSource): BriefField<T> {
  return { value, confidence: Math.min(1, Math.max(0, confidence)), source };
}

function num(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseFloat(raw) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

function str(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function strings(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? [raw] : [];
  return [...new Set(list.map((item) => (item && typeof item === 'object' ? str((item as Record<string, unknown>).value ?? (item as Record<string, unknown>).name) : str(item))).filter(Boolean))];
}

/** Confidence of a raw field: stated, or the mean of per-item confidences, or a default for a value without one. */
function confidenceOf(raw: unknown, hasValue: boolean): number {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;
  const stated = num(record?.confidence);
  if (stated !== undefined) return stated;
  if (Array.isArray(raw)) {
    const items = raw.map((item) => (item && typeof item === 'object' ? num((item as Record<string, unknown>).confidence) : undefined)).filter((n): n is number => n !== undefined);
    if (items.length > 0) return items.reduce((a, b) => a + b, 0) / items.length;
  }
  return hasValue ? UNSTATED_CONFIDENCE : 0;
}

function valueOf(raw: unknown): unknown {
  return raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as Record<string, unknown>) ? (raw as Record<string, unknown>).value : raw;
}

function textField(raw: unknown, source: BriefSource): BriefField<string> {
  const value = str(valueOf(raw));
  return field(value, confidenceOf(raw, !!value), source);
}

function listField(raw: unknown, source: BriefSource): BriefField<string[]> {
  const value = strings(valueOf(raw));
  // An explicit empty list with a stated confidence is a real answer ("surely none").
  return field(value, confidenceOf(raw, value.length > 0), source);
}

/** Level names in free text or a list ("context", "C2", "ngữ cảnh"), in drawing order. */
export function levelsFromText(raw: unknown): C4Level[] {
  const text = (Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '').normalize('NFC').toLowerCase();
  const found = new Set<C4Level>();
  for (const token of text.split(/[^\p{L}\p{N}]+/u)) {
    const level = C4_LEVEL_ALIASES[token];
    if (level) found.add(level);
  }
  for (const [phrase, key] of Object.entries(LEVEL_ANSWER_WORDS)) {
    if (new RegExp(`(?<!\\p{L})${phrase}(?!\\p{L})`, 'u').test(text)) found.add(C4_LEVEL_ALIASES[key]);
  }
  return C4_LEVEL_ORDER.filter((level) => found.has(level));
}

function levelsField(raw: unknown, source: BriefSource): BriefField<C4Level[]> {
  const value = levelsFromText(valueOf(raw));
  return field(value, confidenceOf(raw, value.length > 0), source);
}

function rubricOf(raw: unknown): BriefRubricItem[] {
  return (Array.isArray(raw) ? raw : [])
    .map((item): Record<string, unknown> => (item && typeof item === 'object' ? (item as Record<string, unknown>) : { criterion: item }))
    .map((r) => ({ criterion: str(r.criterion ?? r.name), weight: num(r.weight) ?? 1 }))
    .filter((r) => r.criterion);
}

export function emptyBrief(): ProblemBrief {
  const none = BriefSource.DEFAULT;
  return {
    systemName: field('', 0, none),
    systemBoundary: field('', 0, none),
    actors: field<string[]>([], 0, none),
    externalSystems: field<string[]>([], 0, none),
    functionalReqs: [],
    nonFunctionalReqs: [],
    techConstraints: field<string[]>([], 0, none),
    levels: field<C4Level[]>([], 0, none),
    rubric: [],
    userDesign: { present: false, imageIndexes: [] },
  };
}

/** A brief from the extraction model's JSON; lenient about shapes (`{value, confidence}`, plain values, per-item confidences). */
export function toProblemBrief(raw: Record<string, unknown> | undefined, source: BriefSource, imageCount = 0): ProblemBrief {
  const body = raw ?? {};
  const design = body.userDesign && typeof body.userDesign === 'object' ? (body.userDesign as Record<string, unknown>) : {};
  const indexes = (Array.isArray(design.imageIndexes) ? design.imageIndexes : [])
    .map(num).filter((n): n is number => n !== undefined && Number.isInteger(n) && n >= 0 && n < imageCount);
  return {
    systemName: textField(body.systemName, source),
    systemBoundary: textField(body.systemBoundary, source),
    actors: listField(body.actors, source),
    externalSystems: listField(body.externalSystems, source),
    functionalReqs: strings(body.functionalReqs),
    nonFunctionalReqs: strings(body.nonFunctionalReqs),
    techConstraints: listField(body.techConstraints ?? body.constraints, source),
    levels: levelsField(body.levels ?? (body.deliverables as Record<string, unknown> | undefined)?.levels ?? body.deliverables, source),
    rubric: rubricOf(body.rubric),
    userDesign: { present: design.present === true && indexes.length > 0, imageIndexes: [...new Set(indexes)] },
  };
}

/** Only the fields the typed text states (the extraction's `typed` part): empty fields are left out. */
export function toBriefOverride(raw: Record<string, unknown> | undefined): BriefOverride {
  if (!raw) return {};
  const brief = toProblemBrief(raw, BriefSource.TEXT);
  const override: BriefOverride = {};
  if (brief.systemName.value) override.systemName = { ...brief.systemName, confidence: Math.max(brief.systemName.confidence, USER_STATED_CONFIDENCE) };
  if (brief.systemBoundary.value) override.systemBoundary = brief.systemBoundary;
  if (brief.actors.value.length) override.actors = brief.actors;
  if (brief.externalSystems.value.length) override.externalSystems = brief.externalSystems;
  if (brief.techConstraints.value.length) override.techConstraints = brief.techConstraints;
  if (brief.levels.value.length) override.levels = { ...brief.levels, confidence: USER_STATED_CONFIDENCE };
  if (brief.functionalReqs.length) override.functionalReqs = brief.functionalReqs;
  if (brief.nonFunctionalReqs.length) override.nonFunctionalReqs = brief.nonFunctionalReqs;
  if (brief.rubric.length) override.rubric = brief.rubric;
  return override;
}

// ── merge ──────────────────────────────────────────────────────────────────

function union(first: readonly string[], second: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...first, ...second]) {
    const key = item.normalize('NFC').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function mergeList(base: BriefField<string[]>, over: BriefField<string[]> | undefined): BriefField<string[]> {
  if (!over || over.value.length === 0) return base;
  return { value: union(over.value, base.value), confidence: Math.max(over.confidence, base.confidence), source: over.source };
}

/**
 * Typed text (or the user's answers) over the image brief (note 05 §4): scalar fields and the levels are
 * replaced; lists keep the image items after the stated ones (typing "thêm actor Admin" must not drop the
 * actors read from the pages); the stated source wins.
 */
export function mergeBrief(base: ProblemBrief, over: BriefOverride): ProblemBrief {
  return {
    systemName: over.systemName?.value ? over.systemName : base.systemName,
    systemBoundary: over.systemBoundary?.value ? over.systemBoundary : base.systemBoundary,
    actors: mergeList(base.actors, over.actors),
    externalSystems: over.externalSystems && over.externalSystems.value.length === 0 && over.externalSystems.source === BriefSource.USER_ANSWER
      ? over.externalSystems
      : mergeList(base.externalSystems, over.externalSystems),
    functionalReqs: union(over.functionalReqs ?? [], base.functionalReqs),
    nonFunctionalReqs: union(over.nonFunctionalReqs ?? [], base.nonFunctionalReqs),
    techConstraints: mergeList(base.techConstraints, over.techConstraints),
    levels: over.levels?.value.length ? over.levels : base.levels,
    rubric: over.rubric?.length ? over.rubric : base.rubric,
    userDesign: over.userDesign
      ? { present: base.userDesign.present || over.userDesign.present, imageIndexes: [...new Set([...base.userDesign.imageIndexes, ...over.userDesign.imageIndexes])] }
      : base.userDesign,
  };
}

/** Levels the client asked for explicitly (`--ctx --cnt`): stated by the user. */
export function withRequestedLevels(brief: ProblemBrief, levels: readonly C4Level[]): ProblemBrief {
  if (levels.length === 0) return brief;
  return { ...brief, levels: field(C4_LEVEL_ORDER.filter((l) => levels.includes(l)), USER_STATED_CONFIDENCE, BriefSource.TEXT) };
}

/** Levels to draw: the brief's, else the default pair. */
export function briefLevels(brief: ProblemBrief): C4Level[] {
  return brief.levels.value.length > 0 ? [...brief.levels.value] : [...DEFAULT_C4_LEVELS];
}

// ── gap analysis (note 05 §5) ──────────────────────────────────────────────

/** How sure the brief is about a slot (0 = missing). */
export function slotConfidence(brief: ProblemBrief, slot: C4Slot): number {
  switch (slot) {
    case C4Slot.SYSTEM_BOUNDARY: return brief.systemBoundary.value ? brief.systemBoundary.confidence : 0;
    case C4Slot.ACTORS: return brief.actors.value.length ? brief.actors.confidence : 0;
    case C4Slot.EXTERNAL_SYSTEMS: return brief.externalSystems.confidence;
    case C4Slot.LEVELS: return brief.levels.value.length ? brief.levels.confidence : 0;
    case C4Slot.TECH_CONSTRAINTS: return brief.techConstraints.confidence;
    case C4Slot.RUBRIC: return brief.rubric.length ? 1 : 0;
    default: return 0;
  }
}

/** What is used when the slot is not answered. */
export function slotDefault(brief: ProblemBrief, slot: C4Slot): string {
  switch (slot) {
    case C4Slot.SYSTEM_BOUNDARY: return brief.systemBoundary.value || SlotDefaults.BOUNDARY(brief.systemName.value);
    case C4Slot.ACTORS: return brief.actors.value.length ? brief.actors.value.join(', ') : SlotDefaults.ACTORS_FROM_FR;
    case C4Slot.EXTERNAL_SYSTEMS: return brief.externalSystems.value.length ? brief.externalSystems.value.join(', ') : SlotDefaults.NONE;
    case C4Slot.LEVELS: return brief.levels.value.length ? levelLabel(brief.levels.value) : SlotDefaults.LEVELS;
    case C4Slot.TECH_CONSTRAINTS: return brief.techConstraints.value.length ? brief.techConstraints.value.join(', ') : SlotDefaults.TECH;
    case C4Slot.RUBRIC: return SlotDefaults.RUBRIC;
    default: return '';
  }
}

function levelLabel(levels: readonly C4Level[]): string {
  return levels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join(' + ');
}

/**
 * Asking rules (note 05 §5): skip with `--fast`, for a review of a design that is present, and for a revision;
 * otherwise ask only slots with impact high/medium AND confidence < 0.6 — at most 3, highest impact first,
 * each with its default. Nothing below the threshold = every slot is confident enough.
 */
export function analyzeGaps(brief: ProblemBrief, options: GapAnalysisOptions): GapAnalysis {
  if (options.fast) return { questions: [], skipped: ClarifySkipReason.FAST };
  if (options.reviewWithDesign) return { questions: [], skipped: ClarifySkipReason.REVIEW_WITH_DESIGN };
  if (options.revise) return { questions: [], skipped: ClarifySkipReason.REVISE };
  const questions: ClarifyQuestion[] = SLOT_RULES
    .filter((rule) => rule.impact !== SlotImpact.LOW && slotConfidence(brief, rule.slot) < CLARIFY_MIN_CONFIDENCE)
    .sort((a, b) => IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact])
    .slice(0, MAX_CLARIFY_QUESTIONS)
    .map((rule) => ({ slot: rule.slot, question: rule.question, default: slotDefault(brief, rule.slot), ...(rule.options ? { options: [...rule.options] } : {}) }));
  return questions.length > 0 ? { questions } : { questions, skipped: ClarifySkipReason.CONFIDENT };
}

/** "Mình hiểu đề như sau": 3–5 bullets. */
export function briefSummary(brief: ProblemBrief): string[] {
  const unknown = SummaryLabels.UNKNOWN;
  const bullets = [
    `${SummaryLabels.SYSTEM}: ${brief.systemName.value || unknown}`,
    brief.systemBoundary.value ? `${SummaryLabels.BOUNDARY}: ${brief.systemBoundary.value}` : '',
    `${SummaryLabels.ACTORS}: ${brief.actors.value.length ? brief.actors.value.join(', ') : unknown}`,
    `${SummaryLabels.EXTERNAL}: ${brief.externalSystems.value.length ? brief.externalSystems.value.join(', ') : SlotDefaults.NONE}`,
    brief.functionalReqs.length ? `${SummaryLabels.REQUIREMENTS}: ${brief.functionalReqs.slice(0, SUMMARY_MAX_REQUIREMENTS).join('; ')}` : '',
    `${SummaryLabels.LEVELS}: ${levelLabel(briefLevels(brief))}`,
  ].filter(Boolean);
  // Keep the system first and the levels last; drop the optional middle bullets beyond 5.
  if (bullets.length <= MAX_SUMMARY_BULLETS) return bullets;
  return [...bullets.slice(0, MAX_SUMMARY_BULLETS - 1), bullets[bullets.length - 1]];
}

// ── answers (note 05 §5 rule 3) ────────────────────────────────────────────

function normalizeAnswer(text: string): string {
  return text.normalize('NFC').toLowerCase().trim().replace(TRAILING_PUNCTUATION, '').trim();
}

/** Blank, "ok", "đồng ý"…: keep every default. */
export function isAcceptAll(text: string | undefined): boolean {
  const normalized = normalizeAnswer(text ?? '');
  return !normalized || ACCEPT_ALL_ANSWERS.includes(normalized);
}

/**
 * Answers without a model: numbered lines ("1. …", "2) …") map to the questions in order; one question takes
 * the whole text. Null when the text cannot be mapped (several questions, no numbers) — the aux model's job.
 */
export function parseNumberedAnswers(text: string, questions: readonly ClarifyQuestion[]): SlotAnswers | null {
  if (isAcceptAll(text)) return {};
  const answers: SlotAnswers = {};
  let numbered = false;
  for (const line of text.split(/\r?\n/)) {
    const match = NUMBERED_ANSWER.exec(line);
    if (!match) continue;
    numbered = true;
    const question = questions[Number(match[1]) - 1];
    if (question && !isAcceptAll(match[2])) answers[question.slot] = match[2].trim();
  }
  if (numbered) return answers;
  if (questions.length === 1) return { [questions[0].slot]: text.trim() };
  return null;
}

function listAnswer(answer: string): string[] {
  if (NONE_ANSWERS.includes(normalizeAnswer(answer))) return [];
  return answer.split(LIST_ANSWER_SEPARATOR).map((s) => s.trim().replace(TRAILING_PUNCTUATION, '')).filter(Boolean);
}

/**
 * The brief after the clarify step: answered slots take the user's words (confidence 1); asked but
 * unanswered slots take their default — the shown default is what gets drawn.
 */
export function applyAnswers(brief: ProblemBrief, questions: readonly ClarifyQuestion[], answers: SlotAnswers): ProblemBrief {
  const over: BriefOverride = {};
  const user = BriefSource.USER_ANSWER;
  for (const question of questions) {
    const answer = answers[question.slot]?.trim();
    const stated = !!answer && !isAcceptAll(answer);
    const text = stated ? answer! : question.default;
    const confidence = stated ? USER_STATED_CONFIDENCE : DEFAULT_ACCEPTED_CONFIDENCE;
    const source = stated ? user : BriefSource.DEFAULT;
    switch (question.slot) {
      case C4Slot.SYSTEM_BOUNDARY: over.systemBoundary = field(text, confidence, source); break;
      case C4Slot.ACTORS: if (stated) over.actors = field(listAnswer(text), confidence, source); break;
      case C4Slot.EXTERNAL_SYSTEMS:
        // "Có" alone confirms the systems already read; "Không" means none.
        if (stated && !ACCEPT_ALL_ANSWERS.includes(normalizeAnswer(text))) over.externalSystems = field(listAnswer(text), confidence, source);
        break;
      case C4Slot.LEVELS: {
        const levels = levelsFromText(text);
        over.levels = field(levels.length ? levels : [...DEFAULT_C4_LEVELS], confidence, source);
        break;
      }
      case C4Slot.TECH_CONSTRAINTS: if (stated) over.techConstraints = field(listAnswer(text), confidence, source); break;
      default: break;
    }
  }
  const merged = mergeBrief(brief, over);
  // Asked-but-default slots are now settled assumptions (not asked again).
  for (const question of questions) {
    if (answers[question.slot]) continue;
    if (question.slot === C4Slot.ACTORS) merged.actors = { ...merged.actors, confidence: Math.max(merged.actors.confidence, DEFAULT_ACCEPTED_CONFIDENCE) };
    if (question.slot === C4Slot.EXTERNAL_SYSTEMS) merged.externalSystems = { ...merged.externalSystems, confidence: Math.max(merged.externalSystems.confidence, DEFAULT_ACCEPTED_CONFIDENCE) };
    if (question.slot === C4Slot.TECH_CONSTRAINTS) merged.techConstraints = { ...merged.techConstraints, confidence: Math.max(merged.techConstraints.confidence, DEFAULT_ACCEPTED_CONFIDENCE) };
  }
  return merged;
}

/** The brief as the architect's problem statement (typed text kept verbatim after it). */
export function briefStatement(brief: ProblemBrief, typedText: string): string {
  const lines = [
    brief.systemName.value ? `System: ${brief.systemName.value}` : '',
    brief.systemBoundary.value ? `Scope: ${brief.systemBoundary.value}` : '',
    brief.actors.value.length ? `Actors: ${brief.actors.value.join('; ')}` : '',
    `External systems: ${brief.externalSystems.value.length ? brief.externalSystems.value.join('; ') : 'none stated'}`,
    brief.functionalReqs.length ? `Functional requirements:\n${brief.functionalReqs.map((r) => `- ${r}`).join('\n')}` : '',
    brief.nonFunctionalReqs.length ? `Non-functional requirements:\n${brief.nonFunctionalReqs.map((r) => `- ${r}`).join('\n')}` : '',
    brief.techConstraints.value.length ? `Technology constraints: ${brief.techConstraints.value.join('; ')}` : `Technology: ${SlotDefaults.TECH}`,
  ].filter(Boolean);
  return typedText.trim() ? `${lines.join('\n')}\n\nUser's own words:\n${typedText.trim()}` : lines.join('\n');
}
