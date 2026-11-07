import type { PromptImage } from '../../ai';
import type { C4ConversationRecorder, C4SketchResult } from '../../c4/application/interfaces/c4Sketch.interface';
import { ArtifactKind, ConversationStateKey, MessageKind, MessageRole } from '../../conversation-store';
import type { RecordedArtifact } from './interfaces/conversationTurn.interface';
import type { ConversationTurnService } from './conversationTurn.service';

const PNG_MIME = 'image/png';
const PUML_MIME = 'text/plain';
const MAX_ELEMENTS_LISTED = 25;

/**
 * Turns a C4 run into conversation memory: the assistant message is a text
 * summary (elements + key decisions) the next turns can read, and the spec,
 * PUML and PNG of each level become artifacts (inlined just in time when the
 * user asks about the design).
 */
export class C4ConversationRecorderAdapter implements C4ConversationRecorder {
  constructor(private readonly turns: ConversationTurnService) {}

  async open(conversationId: string): Promise<void> {
    await this.turns.open(conversationId);
  }

  async record(input: { conversationId: string; userText: string; images: PromptImage[]; result: C4SketchResult; paused: boolean }): Promise<{ messageId: string }> {
    const snapshot = await this.turns.open(input.conversationId);
    const { result } = input;
    const artifacts: RecordedArtifact[] = input.images.map((image) => ({
      kind: ArtifactKind.USER_IMAGE, owner: MessageRole.USER, bytes: image.data, mime: image.mimeType, image,
    }));
    if (!input.paused) artifacts.push(...levelArtifacts(result));

    const record = await this.turns.record({
      conversationId: input.conversationId,
      snapshot,
      kind: MessageKind.C4,
      userText: `/c4 ${input.userText}`.trim(),
      assistantText: summarize(result, input.paused),
      assistantMeta: { provider: result.provider, model: result.model, mode: MessageKind.C4, latencyMs: Math.round(result.elapsedMs) },
      artifacts,
      // A finished run clears any pending session left in the conversation.
      ...(input.paused ? {} : { state: { [ConversationStateKey.PENDING_C4]: null } }),
    });
    return { messageId: record.messageId };
  }
}

function levelArtifacts(result: C4SketchResult): RecordedArtifact[] {
  const artifacts: RecordedArtifact[] = [];
  const drawn = result.levels.filter((l) => l.png);
  if (drawn.length > 0) {
    artifacts.push({
      kind: ArtifactKind.C4_SPEC,
      owner: MessageRole.ASSISTANT,
      caption: `C4 spec · ${result.systemName} · ${drawn.map((l) => l.level).join('+')}`,
      dataJson: {
        systemName: result.systemName,
        requirements: result.requirements,
        levels: drawn.map((l) => ({ level: l.level, title: l.title, missing: l.missing, spec: l.spec })),
      },
    });
  }
  for (const level of drawn) {
    artifacts.push({ kind: ArtifactKind.C4_PNG, owner: MessageRole.ASSISTANT, bytes: level.png, mime: PNG_MIME, caption: `C4 ${level.level} diagram — ${level.title ?? result.systemName}` });
    if (level.puml) {
      artifacts.push({
        kind: ArtifactKind.C4_PUML, owner: MessageRole.ASSISTANT, bytes: Buffer.from(level.puml, 'utf-8'), mime: PUML_MIME,
        caption: `PlantUML ${level.level} — ${level.title ?? result.systemName}`, dataJson: { level: level.level, puml: level.puml },
      });
    }
  }
  return artifacts;
}

/** The assistant message the next turns see: what was drawn, with which elements. */
export function summarize(result: C4SketchResult, paused: boolean): string {
  if (paused) {
    const questions = result.confirmation?.clarifications.map((c) => `- ${c.question} (giả định nếu không trả lời: ${c.assumption})`) ?? [];
    return [`C4 "${result.systemName}": cần làm rõ trước khi vẽ.`, ...questions].join('\n');
  }
  const lines = [`Đã vẽ C4 cho "${result.systemName}" (${result.provider}/${result.model}).`];
  if (result.requirements.length > 0) lines.push(`Yêu cầu: ${result.requirements.map((r) => `${r.id} ${r.text}`).join('; ')}`);
  for (const level of result.levels) {
    if (!level.png) {
      lines.push(`- ${level.level}: không vẽ được (${level.error ?? 'lỗi'})`);
      continue;
    }
    const elements = (level.spec?.elements ?? []).slice(0, MAX_ELEMENTS_LISTED).map((e) => `${e.name}${e.tech ? ` [${e.tech}]` : ''}`);
    lines.push(`- ${level.level} "${level.title ?? ''}": ${elements.join(', ')}${level.missing.length ? ` · thiếu: ${level.missing.join(', ')}` : ''}`);
  }
  return lines.join('\n');
}
