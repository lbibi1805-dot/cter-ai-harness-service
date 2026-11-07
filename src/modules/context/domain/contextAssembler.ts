import { ConversationRole, normalizeHistory, type ConversationTurn } from '../../ai';
import {
  ArtifactKind,
  MessageKind,
  MessageRole,
  type ConversationSnapshot,
  type StoredArtifact,
  type StoredMessage,
} from '../../conversation-store';
import {
  ARTIFACT_ALIAS_PATTERN,
  ARTIFACT_REFS_HEADING,
  CHARS_PER_TOKEN,
  CONVERSATION_SOURCE_RULE,
  DESIGN_REFERENCE_WORDS,
  IMAGE_IN_HISTORY_LABEL,
  IMAGE_REFERENCE_WORDS,
  JIT_FOOTER,
  JIT_HEADER,
  MEMORY_HEADER,
  OCR_QUERY_MAX_CHARS,
  REFERENCE_PRONOUNS,
  REGISTRY_FOOTER,
  REGISTRY_HEADER,
  REWRITE_MAX_QUESTION_CHARS,
  SUMMARY_HEADER,
} from './constants/context.constants';
import type { AssembleInput, AssembledContext, CompactionPlan, ContextSettings } from './interfaces/context.interface';

const IMAGE_KINDS = new Set<ArtifactKind>([ArtifactKind.USER_IMAGE, ArtifactKind.C4_PNG]);
const DESIGN_TEXT_KINDS = new Set<ArtifactKind>([ArtifactKind.C4_SPEC, ArtifactKind.C4_PUML, ArtifactKind.PROBLEM_BRIEF, ArtifactKind.DESIGN_REVIEW]);

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function artifactAlias(artifact: Pick<StoredArtifact, 'ordinal'>): string {
  return `A${artifact.ordinal}`;
}

/** Turn number of a message: every turn writes a user then an assistant message. */
export function turnOf(seq: number | null): number | null {
  return seq === null ? null : Math.ceil(seq / 2);
}

function mentions(question: string, words: readonly string[]): boolean {
  const q = ` ${question.toLowerCase()} `;
  return words.some((w) => q.includes(w));
}

function oneLine(text: string, max: number): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** `[A3] user_image · turn 2 · "Đề bài hệ thống đặt vé"` */
export function registryLine(artifact: StoredArtifact): string {
  const turn = turnOf(artifact.messageSeq);
  const caption = artifact.caption ? ` · "${oneLine(artifact.caption, 120)}"` : '';
  return `[${artifactAlias(artifact)}] ${artifact.kind}${turn ? ` · turn ${turn}` : ''}${caption}`;
}

/** Layers ② + ③: the rolling summary and one line per artifact (newest `registryMaxLines`). */
export function buildMemory(snapshot: ConversationSnapshot | null, settings: ContextSettings): string {
  if (!snapshot || (snapshot.messages.length === 0 && snapshot.artifacts.length === 0 && !snapshot.summary)) return '';
  const parts: string[] = [CONVERSATION_SOURCE_RULE];
  if (snapshot.summary?.trim()) parts.push(SUMMARY_HEADER, snapshot.summary.trim());
  const artifacts = snapshot.artifacts.slice(-settings.registryMaxLines);
  if (artifacts.length > 0) parts.push(REGISTRY_HEADER, ...artifacts.map(registryLine), REGISTRY_FOOTER);
  return parts.length ? [MEMORY_HEADER, ...parts].join('\n') : '';
}

/** Layer ④: unsummarized messages as text turns; user turns that had images carry their ids and captions. */
export function buildHistory(snapshot: ConversationSnapshot | null): ConversationTurn[] {
  if (!snapshot) return [];
  const imagesByMessage = new Map<string, StoredArtifact[]>();
  for (const a of snapshot.artifacts) {
    if (a.kind !== ArtifactKind.USER_IMAGE || !a.messageId) continue;
    imagesByMessage.set(a.messageId, [...(imagesByMessage.get(a.messageId) ?? []), a]);
  }
  const turns = snapshot.messages
    .filter((m) => m.kind !== MessageKind.SUMMARY)
    .map((m) => {
      const images = imagesByMessage.get(m.id) ?? [];
      const labels = images.map((a) => `[${IMAGE_IN_HISTORY_LABEL}: ${artifactAlias(a)}${a.caption ? ` — ${oneLine(a.caption, 120)}` : ''}]`);
      const text = [m.text, ...labels].filter((s) => s.trim()).join('\n');
      return { role: m.role === MessageRole.USER ? ConversationRole.USER : ConversationRole.ASSISTANT, text };
    });
  return normalizeHistory(turns);
}

/**
 * Just-in-time artifacts (layer ⑤): images of the last two user turns or the
 * ones the question points at are re-attached; a design question gets the
 * latest C4 spec/PUML inlined. Everything else stays a registry line.
 */
export function selectJit(snapshot: ConversationSnapshot | null, question: string, settings: ContextSettings): { images: StoredArtifact[]; texts: StoredArtifact[] } {
  if (!snapshot || snapshot.artifacts.length === 0) return { images: [], texts: [] };
  const artifacts = snapshot.artifacts;
  const byAlias = new Map(artifacts.map((a) => [artifactAlias(a), a]));
  const explicit = [...question.matchAll(ARTIFACT_ALIAS_PATTERN)].map((m) => byAlias.get(`A${m[1]}`)).filter((a): a is StoredArtifact => !!a);

  const userSeqs = snapshot.messages.filter((m) => m.role === MessageRole.USER).map((m) => m.seq);
  const recentUserSeqs = new Set(userSeqs.slice(-2));
  const images = artifacts.filter((a) => a.kind === ArtifactKind.USER_IMAGE && a.objectKey);
  const picked = new Map<string, StoredArtifact>();
  for (const a of explicit) if (IMAGE_KINDS.has(a.kind) && a.objectKey) picked.set(a.id, a);
  for (const a of images) if (a.messageSeq !== null && recentUserSeqs.has(a.messageSeq)) picked.set(a.id, a);
  if (mentions(question, IMAGE_REFERENCE_WORDS)) for (const a of images.slice(-settings.jitMaxImages)) picked.set(a.id, a);
  const jitImages = [...picked.values()].sort((a, b) => b.ordinal - a.ordinal).slice(0, settings.jitMaxImages).sort((a, b) => a.ordinal - b.ordinal);

  const texts = new Map<string, StoredArtifact>();
  for (const a of explicit) if (DESIGN_TEXT_KINDS.has(a.kind)) texts.set(a.id, a);
  if (mentions(question, DESIGN_REFERENCE_WORDS)) {
    const latestSpec = [...artifacts].reverse().find((a) => a.kind === ArtifactKind.C4_SPEC);
    if (latestSpec) {
      texts.set(latestSpec.id, latestSpec);
      // The PUML drawn in the same turn as that spec.
      for (const a of artifacts) if (a.kind === ArtifactKind.C4_PUML && a.messageId === latestSpec.messageId) texts.set(a.id, a);
    }
  }
  return { images: jitImages, texts: [...texts.values()].sort((a, b) => a.ordinal - b.ordinal) };
}

function artifactText(artifact: StoredArtifact): string {
  const data = artifact.dataJson as Record<string, unknown> | null;
  if (artifact.kind === ArtifactKind.C4_PUML && data && typeof data.puml === 'string') return data.puml;
  if (data && typeof data === 'object') return JSON.stringify(data);
  return artifact.ocrText ?? artifact.caption ?? '';
}

export function buildJitText(images: StoredArtifact[], texts: StoredArtifact[], currentImageCount: number, maxChars: number): string {
  if (images.length === 0 && texts.length === 0) return '';
  const lines: string[] = [JIT_HEADER, 'Artifacts of THIS conversation (valid sources for questions about them):'];
  if (images.length > 0) {
    lines.push(`Images #${currentImageCount + 1}–#${currentImageCount + images.length} of this message are re-attached from earlier turns:`);
    images.forEach((a, i) => lines.push(`- #${currentImageCount + i + 1} = ${registryLine(a)}`));
  }
  let budget = maxChars;
  for (const a of texts) {
    const body = artifactText(a);
    if (!body || budget <= 0) continue;
    const clipped = body.length > budget ? `${body.slice(0, budget)}\n…[truncated]` : body;
    budget -= clipped.length;
    lines.push(`--- ${registryLine(a)} ---`, clipped);
  }
  lines.push(JIT_FOOTER);
  return lines.join('\n');
}

/** OCR (or caption) of the current and re-attached images, one clipped line each. */
export function buildRetrievalHints(input: AssembleInput, jitImages: StoredArtifact[]): string[] {
  return [
    ...input.currentImageNotes.map((n) => n.ocrText || n.caption),
    ...jitImages.map((a) => a.ocrText || a.caption || ''),
  ].map((t) => oneLine(t, OCR_QUERY_MAX_CHARS)).filter(Boolean);
}

/** RAG query: previous user question + the question + image hints. */
export function buildRetrievalQuery(input: AssembleInput, hints: string[]): string {
  const previous = [...(input.snapshot?.messages ?? [])].reverse().find((m) => m.role === MessageRole.USER && m.kind === MessageKind.CHAT);
  const question = input.question.trim();
  if (!question && hints.length === 0) return '';
  return [previous?.text.trim(), question, ...hints].filter((s) => s).join('\n');
}

export function assembleContext(input: AssembleInput): AssembledContext {
  const { images, texts } = selectJit(input.snapshot, input.question, input.settings);
  const hints = buildRetrievalHints(input, images);
  return {
    history: buildHistory(input.snapshot),
    memory: buildMemory(input.snapshot, input.settings),
    jitText: buildJitText(images, texts, input.currentImageCount, input.settings.jitMaxChars),
    jitImages: images,
    retrievalQuery: buildRetrievalQuery(input, hints),
    retrievalHints: hints,
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
