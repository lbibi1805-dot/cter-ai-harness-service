import { ConversationRole, normalizeHistory, type ConversationTurn } from '../../ai';
import {
  ArtifactKind,
  MessageKind,
  MessageRole,
  ResolvedRefSource,
  type ConversationSnapshot,
  type StoredArtifact,
  type StoredMessage,
} from '../../conversation-store';
import { artifactAlias, displayLabel, elementNames, levelsOf, specLevels, systemNameOf, turnOf } from './artifactMetadata';
import { resolveArtifacts, toResolvedRefs } from './artifactResolver';
import { MASKED_COMPOUNDS } from './constants/artifactResolver.constants';
import {
  AMBIGUITY_HEADER,
  ARTIFACT_REFS_HEADING,
  CHARS_PER_TOKEN,
  COMPACT_ELEMENTS_MAX,
  DESIGN_REFERENCE_WORDS,
  IMAGE_IN_HISTORY_LABEL,
  IMAGE_REFERENCE_WORDS,
  JIT_FOOTER,
  JIT_HEADER,
  JIT_INTRO,
  JIT_TRUNCATED,
  MEMORY_HEADER,
  OCR_QUERY_MAX_CHARS,
  REFERENCE_PRONOUNS,
  REGISTRY_FOOTER,
  REGISTRY_HEADER,
  REGISTRY_TEXT_MAX_CHARS,
  REWRITE_MAX_QUESTION_CHARS,
  HOT_WINDOW_IN_HISTORY_NOTE,
  HOT_WINDOW_MAX_IMAGES_PER_TURN,
  SUMMARY_HEADER,
  ambiguityInstruction,
} from './constants/context.constants';
import { ArtifactResolverMode } from './enums/context.enums';
import { containsWord, maskCompounds } from './helpers/textMatch.helper';
import type { ResolveResult } from './interfaces/artifactResolver.interface';
import type { AssembleInput, AssembledContext, CompactionPlan, ContextSettings, HistoryTurnDraft, HotWindowSlot } from './interfaces/context.interface';

export { artifactAlias, turnOf } from './artifactMetadata';

const IMAGE_KINDS = new Set<ArtifactKind>([ArtifactKind.USER_IMAGE, ArtifactKind.C4_PNG]);
const TEXT_KINDS = new Set<ArtifactKind>([ArtifactKind.C4_SPEC, ArtifactKind.C4_PUML, ArtifactKind.PROBLEM_BRIEF, ArtifactKind.DESIGN_REVIEW, ArtifactKind.DESIGN_NOTE]);

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Whole-word match (NFC, compounds such as "vấn đề" masked): `nó` never matches "nói". */
export function mentions(question: string, words: readonly string[]): boolean {
  return containsWord(maskCompounds(question, MASKED_COMPOUNDS), words);
}

function oneLine(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** `[A3] user_image · turn 2 · "Đề bài hệ thống đặt vé"`, `[A7] c4_spec · turn 3 · C4 container · Hệ thống đặt vé`. */
export function registryLine(artifact: StoredArtifact): string {
  const turn = turnOf(artifact.messageSeq);
  const label = artifact.label && artifact.kind !== ArtifactKind.USER_IMAGE ? ` · ${oneLine(artifact.label, REGISTRY_TEXT_MAX_CHARS)}` : '';
  const caption = artifact.caption && !label ? ` · "${oneLine(artifact.caption, REGISTRY_TEXT_MAX_CHARS)}"` : '';
  return `[${artifactAlias(artifact)}] ${artifact.kind}${turn ? ` · turn ${turn}` : ''}${label}${caption}`;
}

function isEmpty(snapshot: ConversationSnapshot | null): snapshot is null {
  return !snapshot || (snapshot.messages.length === 0 && snapshot.artifacts.length === 0 && !snapshot.summary);
}

/** Layer ② alone (layout V2: first history turn). */
export function buildSummary(snapshot: ConversationSnapshot | null): string {
  return snapshot?.summary?.trim() ?? '';
}

function registryLines(snapshot: ConversationSnapshot, settings: ContextSettings): string[] {
  const artifacts = snapshot.artifacts.slice(-settings.registryMaxLines);
  return artifacts.length > 0 ? [REGISTRY_HEADER, ...artifacts.map(registryLine), REGISTRY_FOOTER] : [];
}

/** Layer ③ alone (layout V2: tail of the last message, before the JIT artifacts). */
export function buildRegistry(snapshot: ConversationSnapshot | null, settings: ContextSettings): string {
  if (isEmpty(snapshot)) return '';
  const lines = registryLines(snapshot, settings);
  return lines.length > 0 ? [MEMORY_HEADER, ...lines].join('\n') : '';
}

/** Layout V1 — layers ② + ③ as one system-prompt block (summary, one line per artifact); the source rule is in prompts/policies/conversation.md. */
export function buildMemory(snapshot: ConversationSnapshot | null, settings: ContextSettings): string {
  if (isEmpty(snapshot)) return '';
  const parts: string[] = [];
  if (snapshot.summary?.trim()) parts.push(SUMMARY_HEADER, snapshot.summary.trim());
  parts.push(...registryLines(snapshot, settings));
  return [MEMORY_HEADER, ...parts].join('\n');
}

function groupByMessage(artifacts: StoredArtifact[], keep: (a: StoredArtifact) => boolean): Map<string, StoredArtifact[]> {
  const byMessage = new Map<string, StoredArtifact[]>();
  for (const a of artifacts) {
    if (!a.messageId || !keep(a)) continue;
    byMessage.set(a.messageId, [...(byMessage.get(a.messageId) ?? []), a]);
  }
  return byMessage;
}

/**
 * Layer ④ before images are loaded: the text turns of `buildHistory`, each carrying the image artifacts of its
 * message (user images on a user turn, C4 PNGs on the assistant turn that drew them) for the hot window.
 */
export function buildHistoryDrafts(snapshot: ConversationSnapshot | null): HistoryTurnDraft[] {
  if (!snapshot) return [];
  const labelled = groupByMessage(snapshot.artifacts, (a) => a.kind === ArtifactKind.USER_IMAGE);
  const loadable = groupByMessage(snapshot.artifacts, (a) => !!a.objectKey && (a.kind === ArtifactKind.USER_IMAGE || a.kind === ArtifactKind.C4_PNG));
  const turns = snapshot.messages
    .filter((m) => m.kind !== MessageKind.SUMMARY)
    .map((m): HistoryTurnDraft => {
      const labels = (labelled.get(m.id) ?? []).map((a) => `[${IMAGE_IN_HISTORY_LABEL}: ${artifactAlias(a)}${a.caption ? ` — ${oneLine(a.caption, REGISTRY_TEXT_MAX_CHARS)}` : ''}]`);
      const text = [m.text, ...labels].filter((s) => s.trim()).join('\n');
      const isUser = m.role === MessageRole.USER;
      const images = (loadable.get(m.id) ?? []).filter((a) => (isUser ? a.kind === ArtifactKind.USER_IMAGE : a.kind === ArtifactKind.C4_PNG));
      return { role: isUser ? ConversationRole.USER : ConversationRole.ASSISTANT, text, ...(images.length ? { images } : {}) };
    });
  return normalizeHistory(turns);
}

/** Layer ④: unsummarized messages as text turns; user turns that had images carry their ids and captions. */
export function buildHistory(snapshot: ConversationSnapshot | null): ConversationTurn[] {
  return buildHistoryDrafts(snapshot).map(({ role, text }) => ({ role, text }));
}

/**
 * Hot window (note 18 step 5): the image artifacts of the last `turns` user/assistant pairs, per history turn,
 * in artifact ordinal order, at most HOT_WINDOW_MAX_IMAGES_PER_TURN each. The history ends with an assistant
 * turn and alternates, so the last 2·K turns are the last K pairs.
 */
export function selectHotWindow(drafts: HistoryTurnDraft[], turns: number): HotWindowSlot[] {
  if (turns <= 0) return [];
  const slots: HotWindowSlot[] = [];
  for (let i = Math.max(0, drafts.length - 2 * turns); i < drafts.length; i++) {
    const artifacts = [...(drafts[i].images ?? [])].sort((a, b) => a.ordinal - b.ordinal).slice(0, HOT_WINDOW_MAX_IMAGES_PER_TURN);
    if (artifacts.length > 0) slots.push({ turnIndex: i, artifacts });
  }
  return slots;
}

/** Keeps at most `budget` window images: drops the oldest first, the ones the resolver picked last. */
export function capHotWindow(slots: HotWindowSlot[], budget: number, picked: ReadonlySet<string>): HotWindowSlot[] {
  const all = slots.flatMap((s) => s.artifacts);
  if (all.length <= budget) return slots;
  const dropOrder = [...all].sort((a, b) => Number(picked.has(a.id)) - Number(picked.has(b.id)) || a.ordinal - b.ordinal);
  const dropped = new Set(dropOrder.slice(0, all.length - Math.max(0, budget)).map((a) => a.id));
  return slots
    .map((s) => ({ turnIndex: s.turnIndex, artifacts: s.artifacts.filter((a) => !dropped.has(a.id)) }))
    .filter((s) => s.artifacts.length > 0);
}

// ── ⑤ just-in-time artifacts ───────────────────────────────────────────────

/** One inlined text block, in relevance order (the budget cuts the tail first). */
export interface JitSection {
  artifact: StoredArtifact;
  /** Level shown in the heading (spec cut per level). */
  level?: string;
  body: string;
}

export interface JitAmbiguity {
  choices: StoredArtifact[];
  /** The default the model answers with meanwhile (newest choice). */
  fallback: StoredArtifact;
}

export interface JitSelection {
  images: StoredArtifact[];
  sections: JitSection[];
  ambiguity: JitAmbiguity | null;
}

const EMPTY_SELECTION: JitSelection = { images: [], sections: [], ambiguity: null };

/** Asked levels first, then the rest, each group in its original order. */
function byLevelRelevance<T>(items: T[], levelOf: (item: T) => string | undefined, asked: string[]): T[] {
  const rank = (item: T) => (asked.includes(levelOf(item) ?? '') ? 0 : 1);
  return items.map((item, i) => ({ item, i })).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i).map((x) => x.item);
}

function textBody(artifact: StoredArtifact): string {
  const data = artifact.dataJson as Record<string, unknown> | null;
  if (artifact.kind === ArtifactKind.C4_PUML && data && typeof data.puml === 'string') return data.puml;
  if (data && typeof data === 'object') return JSON.stringify(data);
  return artifact.ocrText ?? artifact.caption ?? '';
}

/** A spec cut per level (asked level first) followed by the PUML of the same run (asked level first). */
function specSections(spec: StoredArtifact, all: StoredArtifact[], asked: string[]): JitSection[] {
  const levels = specLevels(spec);
  const data = (spec.dataJson ?? {}) as Record<string, unknown>;
  const pumls = byLevelRelevance(all.filter((a) => a.kind === ArtifactKind.C4_PUML && a.messageId === spec.messageId), (a) => levelsOf(a)[0], asked);
  const pumlSections = pumls.map((p) => ({ artifact: p, level: levelsOf(p)[0], body: textBody(p) }));
  if (levels.length === 0) return [{ artifact: spec, body: textBody(spec) }, ...pumlSections];
  const ordered = byLevelRelevance(levels, (l) => l.level, asked);
  const specParts = ordered.map((level, i) => ({
    artifact: spec,
    level: level.level,
    body: JSON.stringify({ systemName: data.systemName, ...(i === 0 && data.requirements ? { requirements: data.requirements } : {}), ...level }),
  }));
  const isAsked = (s: JitSection) => !!s.level && asked.includes(s.level);
  // Relevance order: asked spec levels, their PUML, then the other levels, then the other PUML.
  return [...specParts.filter(isAsked), ...pumlSections.filter(isAsked), ...specParts.filter((s) => !isAsked(s)), ...pumlSections.filter((s) => !isAsked(s))];
}

/** The C4 PNGs drawn with a spec (asked level first). */
function drawnImages(spec: StoredArtifact, all: StoredArtifact[], asked: string[]): StoredArtifact[] {
  return byLevelRelevance(all.filter((a) => a.kind === ArtifactKind.C4_PNG && a.objectKey && a.messageId === spec.messageId), (a) => levelsOf(a)[0], asked);
}

function sectionsFor(picked: StoredArtifact[], all: StoredArtifact[], asked: string[]): JitSection[] {
  const sections: JitSection[] = [];
  for (const a of picked) {
    if (a.kind === ArtifactKind.C4_SPEC) sections.push(...specSections(a, all, asked));
    else if (TEXT_KINDS.has(a.kind)) sections.push({ artifact: a, level: levelsOf(a)[0], body: textBody(a) });
  }
  const seen = new Set<string>();
  return sections.filter((s) => {
    const key = `${s.artifact.id}:${s.level ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** ARTIFACT_RESOLVER_MODE=off: the 04 rules (latest spec on a design word, latest user images on an image word). */
function legacyTexts(artifacts: StoredArtifact[], question: string): StoredArtifact[] {
  if (!mentions(question, DESIGN_REFERENCE_WORDS)) return [];
  const latestSpec = [...artifacts].reverse().find((a) => a.kind === ArtifactKind.C4_SPEC);
  return latestSpec ? [latestSpec] : [];
}

/**
 * Just-in-time artifacts (layer ⑤): what the resolver picked (spec cut per level, its
 * PUML, and its PNG when the question is about the drawn picture), the images of the
 * last two user turns, and — when ambiguous — the choices plus the default's content.
 */
export function selectJit(snapshot: ConversationSnapshot | null, question: string, settings: ContextSettings, resolution?: ResolveResult): JitSelection {
  if (!snapshot || snapshot.artifacts.length === 0) return EMPTY_SELECTION;
  const artifacts = snapshot.artifacts;
  const resolved = resolution ?? resolveArtifacts({ question, artifacts, messages: snapshot.messages, settings: settings.resolver });
  const asked = resolved.signals.levels;
  const legacy = settings.resolver.mode === ArtifactResolverMode.OFF && resolved.source === ResolvedRefSource.NONE;

  const picked = legacy ? legacyTexts(artifacts, question) : resolved.picked;
  const images = new Map<string, StoredArtifact>();
  for (const a of picked) {
    if (IMAGE_KINDS.has(a.kind) && a.objectKey) images.set(a.id, a);
    if (a.kind === ArtifactKind.C4_SPEC && (resolved.signals.drawn || resolved.source === ResolvedRefSource.UI)) {
      for (const png of drawnImages(a, artifacts, asked)) images.set(png.id, png);
    }
  }
  const resolvedImages = [...images.values()];
  const recentUserSeqs = new Set(snapshot.messages.filter((m) => m.role === MessageRole.USER).map((m) => m.seq).slice(-2));
  const userImages = artifacts.filter((a) => a.kind === ArtifactKind.USER_IMAGE && a.objectKey);
  const recent = userImages.filter((a) => a.messageSeq !== null && recentUserSeqs.has(a.messageSeq));
  const legacyImages = legacy && mentions(question, IMAGE_REFERENCE_WORDS) ? userImages.slice(-settings.jitMaxImages) : [];
  // Resolved images first (they are what the question is about), then the recent and legacy ones.
  const chosen = new Map<string, StoredArtifact>();
  for (const a of [...resolvedImages, ...recent.reverse(), ...[...legacyImages].reverse()]) if (chosen.size < settings.jitMaxImages) chosen.set(a.id, a);

  const ambiguity = resolved.ambiguous && resolved.picked[0]
    ? { choices: resolved.candidates.map((c) => c.artifact).sort((a, b) => a.ordinal - b.ordinal), fallback: resolved.picked[0] }
    : null;
  return {
    images: [...chosen.values()].sort((a, b) => a.ordinal - b.ordinal),
    sections: sectionsFor(picked, artifacts, asked),
    ambiguity,
  };
}

function compactLine(artifact: StoredArtifact): string {
  const turn = turnOf(artifact.messageSeq);
  const elements = elementNames(artifact).slice(0, COMPACT_ELEMENTS_MAX);
  const system = systemNameOf(artifact);
  const label = displayLabel(artifact);
  return `[${artifactAlias(artifact)}] ${oneLine(label, REGISTRY_TEXT_MAX_CHARS)}${system && !label.includes(system) ? ` (${system})` : ''}${turn ? ` (turn ${turn})` : ''}${elements.length ? ` — ${elements.join(', ')}` : ''}`;
}

export function buildJitText(selection: JitSelection, currentImageCount: number, maxChars: number, inHistory: StoredArtifact[] = []): string {
  const { images, sections, ambiguity } = selection;
  if (images.length === 0 && sections.length === 0 && !ambiguity && inHistory.length === 0) return '';
  const lines: string[] = [JIT_HEADER, JIT_INTRO];
  if (ambiguity) {
    lines.push(AMBIGUITY_HEADER);
    ambiguity.choices.forEach((a, i) => lines.push(`${i + 1}. ${compactLine(a)}`));
    const defaultIndex = ambiguity.choices.findIndex((a) => a.id === ambiguity.fallback.id) + 1;
    const other = ambiguity.choices.find((a) => a.id !== ambiguity.fallback.id) ?? ambiguity.fallback;
    lines.push(ambiguityInstruction(defaultIndex, artifactAlias(ambiguity.fallback), artifactAlias(other)));
  }
  if (images.length > 0) {
    lines.push(`Images #${currentImageCount + 1}–#${currentImageCount + images.length} of this message are re-attached from earlier turns:`);
    images.forEach((a, i) => lines.push(`- #${currentImageCount + i + 1} = ${registryLine(a)}`));
  }
  for (const a of inHistory) lines.push(`- ${registryLine(a)} — ${HOT_WINDOW_IN_HISTORY_NOTE}`);
  let budget = maxChars;
  for (const s of sections) {
    if (!s.body || budget <= 0) continue;
    const clipped = s.body.length > budget ? `${s.body.slice(0, budget)}${JIT_TRUNCATED}` : s.body;
    budget -= clipped.length;
    lines.push(`--- ${registryLine(s.artifact)}${s.level ? ` · level ${s.level}` : ''} ---`, clipped);
  }
  lines.push(JIT_FOOTER);
  return lines.join('\n');
}

/** OCR (or caption) of the current and re-attached images, one clipped line each. */
export function buildRetrievalHints(input: AssembleInput, jitImages: StoredArtifact[]): string[] {
  return [
    ...input.currentImageNotes.map((n) => n.ocrText || n.caption),
    ...jitImages.filter((a) => a.kind === ArtifactKind.USER_IMAGE).map((a) => a.ocrText || a.caption || ''),
  ].map((t) => oneLine(t, OCR_QUERY_MAX_CHARS)).filter(Boolean);
}

/** RAG query: previous user question + the question + image hints. */
export function buildRetrievalQuery(input: AssembleInput, hints: string[]): string {
  const previous = [...(input.snapshot?.messages ?? [])].reverse().find((m) => m.role === MessageRole.USER && m.kind === MessageKind.CHAT);
  const question = input.question.trim();
  if (!question && hints.length === 0) return '';
  return [previous?.text.trim(), question, ...hints].filter((s) => s).join('\n');
}

/** Rules-only resolution of a question against a snapshot (the turn service may pass an aux-refined one instead). */
export function resolveForSnapshot(snapshot: ConversationSnapshot | null, question: string, settings: ContextSettings, refIds?: string[]): ResolveResult {
  return resolveArtifacts({ question, artifacts: snapshot?.artifacts ?? [], messages: snapshot?.messages ?? [], refIds, settings: settings.resolver });
}

/**
 * Splits the images of a request between the hot window (in place in history) and the JIT tail: a picked image
 * already in the window is not re-attached (`inHistory` names it instead); current + window + JIT ≤ maxPromptImages.
 * Window off (K = 0) → exactly the old JIT images.
 */
function placeHotWindow(drafts: HistoryTurnDraft[], jitAll: StoredArtifact[], input: AssembleInput): { slots: HotWindowSlot[]; jitImages: StoredArtifact[]; inHistory: StoredArtifact[] } {
  const { hotWindowTurns, maxPromptImages } = input.settings;
  const selected = selectHotWindow(drafts, hotWindowTurns ?? 0);
  if (selected.length === 0) return { slots: [], jitImages: jitAll, inHistory: [] };
  const picked = new Set(jitAll.map((a) => a.id));
  const selectedIds = new Set(selected.flatMap((s) => s.artifacts.map((a) => a.id)));
  const jitOutside = jitAll.filter((a) => !selectedIds.has(a.id)).length;
  const slots = capHotWindow(selected, maxPromptImages - input.currentImageCount - jitOutside, picked);
  const inWindow = new Set(slots.flatMap((s) => s.artifacts.map((a) => a.id)));
  const jitImages = jitAll.filter((a) => !inWindow.has(a.id)).slice(0, Math.max(0, maxPromptImages - input.currentImageCount - inWindow.size));
  return { slots, jitImages, inHistory: jitAll.filter((a) => inWindow.has(a.id)) };
}

export function assembleContext(input: AssembleInput): AssembledContext {
  const resolution = input.resolution ?? resolveForSnapshot(input.snapshot, input.question, input.settings, input.refIds);
  const selection = selectJit(input.snapshot, input.question, input.settings, resolution);
  const hints = buildRetrievalHints(input, selection.images);
  const drafts = buildHistoryDrafts(input.snapshot);
  const window = placeHotWindow(drafts, selection.images, input);
  return {
    history: drafts.map(({ role, text }) => ({ role, text })),
    memory: buildMemory(input.snapshot, input.settings),
    summary: buildSummary(input.snapshot),
    registry: buildRegistry(input.snapshot, input.settings),
    jitText: buildJitText({ ...selection, images: window.jitImages }, input.currentImageCount, input.settings.jitMaxChars, window.inHistory),
    jitImages: window.jitImages,
    hotWindow: window.slots,
    retrievalQuery: buildRetrievalQuery(input, hints),
    retrievalHints: hints,
    resolvedRefs: input.snapshot ? toResolvedRefs(resolution) : null,
  };
}

/** A short follow-up with a reference pronoun ("giải thích nó kỹ hơn") needs a standalone rewrite for RAG. */
export function needsQueryRewrite(question: string, hasHistory: boolean): boolean {
  const q = question.trim();
  return hasHistory && q.length > 0 && q.length <= REWRITE_MAX_QUESTION_CHARS && mentions(q, REFERENCE_PRONOUNS);
}

/**
 * When the unsummarized part grows past the threshold (tokens or turns),
 * everything but the newest `keepRecentTurns` turns is folded into the summary.
 */
export function planCompaction(summaryUptoSeq: number, messages: StoredMessage[], artifacts: StoredArtifact[], settings: ContextSettings): CompactionPlan | null {
  const pending = messages.filter((m) => m.seq > summaryUptoSeq).sort((a, b) => a.seq - b.seq);
  const tokens = pending.reduce((sum, m) => sum + estimateTokens(m.text), 0);
  const turns = pending.filter((m) => m.role === MessageRole.USER).length;
  if (tokens <= settings.compactThresholdTokens && turns <= settings.compactMaxTurns) return null;

  const userIdx = pending.map((m, i) => (m.role === MessageRole.USER ? i : -1)).filter((i) => i >= 0);
  const keepFrom = userIdx.length > settings.keepRecentTurns ? userIdx[userIdx.length - settings.keepRecentTurns] : 0;
  const toSummarize = pending.slice(0, keepFrom);
  if (toSummarize.length === 0) return null;
  const uptoSeq = toSummarize[toSummarize.length - 1].seq;
  const requiredRefs = artifacts.filter((a) => a.messageSeq === null || a.messageSeq <= uptoSeq).map(artifactAlias);
  return { toSummarize, uptoSeq, requiredRefs };
}

/** The summary must never lose an artifact id: missing ones are appended. */
export function ensureArtifactRefs(summary: string, requiredRefs: string[]): string {
  const missing = requiredRefs.filter((ref) => !new RegExp(`\\b${ref}\\b`).test(summary));
  if (missing.length === 0) return summary.trim();
  return `${summary.trim()}\n\n${ARTIFACT_REFS_HEADING}: ${missing.join(', ')}`;
}
