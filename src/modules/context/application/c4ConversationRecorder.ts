import type { PromptImage } from '../../ai';
import type { C4ArtifactRef, C4ConversationRecorder, C4RecordInput, C4SketchResult } from '../../c4/application/interfaces/c4Sketch.interface';
import { ArtifactKind, ConversationStateKey, MessageKind, MessageRole, type ConversationSnapshot, type StoredArtifact } from '../../conversation-store';
import type { RecordedArtifact } from './interfaces/conversationTurn.interface';
import type { ConversationTurnService } from './conversationTurn.service';

const PNG_MIME = 'image/png';
const PUML_MIME = 'text/plain';
const MAX_ELEMENTS_LISTED = 25;
/** Intent value of a review-only run (stored as MessageKind.C4_REVIEW). */
const REVIEW_ONLY_INTENT = 'c4_review';
const REVIEW_FLAG = '--review';
const REVIEW_SUMMARY_MAX_CHARS = 600;

/**
 * Turns a C4 run into conversation memory: the assistant message is a text summary (brief, elements, review)
 * the next turns can read; the brief, the spec/PUML/PNG of each level and the review become artifacts
 * (a revision continues its base spec's version chain); the router's intent is stored on both messages.
 */
export class C4ConversationRecorderAdapter implements C4ConversationRecorder {
  constructor(private readonly turns: ConversationTurnService) {}

  open(conversationId: string): Promise<ConversationSnapshot | null> {
    return this.turns.open(conversationId);
  }

  loadImages(artifacts: StoredArtifact[]): Promise<PromptImage[]> {
    return this.turns.loadImages(artifacts);
  }

  async record(input: C4RecordInput): Promise<{ messageId: string; artifacts?: C4ArtifactRef[] }> {
    // Read again (not the run's start snapshot): aliases/turns follow what is stored now.
    const snapshot = await this.turns.open(input.conversationId);
    const { result } = input;
    const artifacts: RecordedArtifact[] = input.images.map((image) => ({
      kind: ArtifactKind.USER_IMAGE, owner: MessageRole.USER, bytes: image.data, mime: image.mimeType, image,
    }));
    if (input.recordBrief && result.brief) {
      artifacts.push({
        kind: ArtifactKind.PROBLEM_BRIEF, owner: MessageRole.ASSISTANT, systemName: result.brief.systemName.value || undefined,
        caption: `Đề đã hiểu · ${result.brief.systemName.value || result.systemName}`, dataJson: result.brief,
      });
    }
    if (!input.paused) artifacts.push(...levelArtifacts(result));
    if (result.review) {
      artifacts.push({
        kind: ArtifactKind.DESIGN_REVIEW, owner: MessageRole.ASSISTANT, systemName: result.systemName || undefined,
        caption: `Đánh giá thiết kế · ${result.review.designLabel ?? result.systemName}`,
        dataJson: { markdown: result.review.markdown, designSource: result.review.designSource, designLabel: result.review.designLabel ?? null, systemName: result.systemName },
      });
    }
    const reviewOnly = result.intent?.intent === REVIEW_ONLY_INTENT;
    const record = await this.turns.record({
      conversationId: input.conversationId,
      snapshot,
      kind: reviewOnly ? MessageKind.C4_REVIEW : MessageKind.C4,
      userText: `/c4${reviewOnly ? ` ${REVIEW_FLAG}` : ''} ${input.userText}`.trim(),
      assistantText: summarize(result, input.paused),
      assistantMeta: { provider: result.provider, model: result.model, mode: MessageKind.C4, latencyMs: Math.round(result.elapsedMs) },
      artifacts,
      ...(result.intent ? { intent: { intent: result.intent.intent, confidence: result.intent.confidence } } : {}),
      // A finished run clears any pending session left in the conversation.
      ...(input.paused ? {} : { state: { [ConversationStateKey.PENDING_C4]: null } }),
    });
    return { messageId: record.messageId, ...(record.artifacts ? { artifacts: record.artifacts } : {}) };
  }
}

function levelArtifacts(result: C4SketchResult): RecordedArtifact[] {
  const artifacts: RecordedArtifact[] = [];
  const drawn = result.levels.filter((l) => l.png);
  if (drawn.length > 0) {
    artifacts.push({
      kind: ArtifactKind.C4_SPEC,
      owner: MessageRole.ASSISTANT,
      systemName: result.systemName,
      caption: `C4 spec · ${result.systemName} · ${drawn.map((l) => l.level).join('+')}`,
      dataJson: {
        systemName: result.systemName,
        requirements: result.requirements,
        levels: drawn.map((l) => ({ level: l.level, title: l.title, missing: l.missing, spec: l.spec })),
      },
      // c4_revise: the new spec continues the base's chain (note 17 §4); otherwise inferred by system name.
      ...(result.revision ? { parentArtifactId: result.revision.parentArtifactId, version: result.revision.version } : {}),
    });
  }
  for (const level of drawn) {
    artifacts.push({
      kind: ArtifactKind.C4_PNG, owner: MessageRole.ASSISTANT, bytes: level.png, mime: PNG_MIME, level: level.level, systemName: result.systemName,
      caption: `C4 ${level.level} diagram — ${level.title ?? result.systemName}`,
      ...(result.revision ? { version: result.revision.version } : {}),
    });
    if (level.puml) {
      artifacts.push({
        kind: ArtifactKind.C4_PUML, owner: MessageRole.ASSISTANT, bytes: Buffer.from(level.puml, 'utf-8'), mime: PUML_MIME, level: level.level, systemName: result.systemName,
        caption: `PlantUML ${level.level} — ${level.title ?? result.systemName}`, dataJson: { level: level.level, puml: level.puml },
        ...(result.revision ? { version: result.revision.version } : {}),
      });
    }
  }
  return artifacts;
}

/** The assistant message the next turns see: brief/questions, what was drawn with which elements, the review. */
export function summarize(result: C4SketchResult, paused: boolean): string {
  if (paused) {
    const summary = result.clarify?.summary.map((s) => `- ${s}`) ?? [];
    const questions = result.clarify?.questions.map((q, i) => `${i + 1}. ${q.question} → Mặc định: ${q.default}`)
      ?? result.confirmation?.clarifications.map((c) => `- ${c.question} (giả định nếu không trả lời: ${c.assumption})`) ?? [];
    return [`C4 "${result.systemName}": mình hiểu đề như sau:`, ...summary, `Còn ${questions.length} điểm cần xác nhận:`, ...questions, 'Trả lời "ok" để dùng toàn bộ mặc định.'].join('\n');
  }
  const lines: string[] = [];
  if (result.levels.length > 0) {
    lines.push(`Đã vẽ C4 cho "${result.systemName}" (${result.provider}/${result.model})${result.revision ? `, sửa từ [${result.revision.baseAlias}] → v${result.revision.version}` : ''}.`);
    if (result.requirements.length > 0) lines.push(`Yêu cầu: ${result.requirements.map((r) => `${r.id} ${r.text}`).join('; ')}`);
    for (const level of result.levels) {
      if (!level.png) {
        lines.push(`- ${level.level}: không vẽ được (${level.error ?? 'lỗi'})`);
        continue;
      }
      const elements = (level.spec?.elements ?? []).slice(0, MAX_ELEMENTS_LISTED).map((e) => `${e.name}${e.tech ? ` [${e.tech}]` : ''}`);
      lines.push(`- ${level.level} "${level.title ?? ''}": ${elements.join(', ')}${level.missing.length ? ` · thiếu: ${level.missing.join(', ')}` : ''}`);
    }
    if (result.criticNotes?.length) lines.push(`Critic: ${result.criticNotes.join(' | ')}`);
  }
  if (result.review) {
    const summary = result.review.markdown.split(/\n## /)[0].replace(/^## [^\n]*\n+/, '').trim().slice(0, REVIEW_SUMMARY_MAX_CHARS);
    lines.push(`Đánh giá ${result.review.designLabel ?? 'thiết kế'}: ${summary}`);
  } else if (result.review === null) {
    lines.push('Không viết được bài đánh giá (không tìm thấy thiết kế hoặc lỗi model).');
  }
  return lines.join('\n') || `C4 "${result.systemName}": không có kết quả.`;
}
