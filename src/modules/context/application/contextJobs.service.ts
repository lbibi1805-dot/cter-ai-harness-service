import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { extractJsonObject } from '../../c4/application/helpers/c4Answer.helper';
import type { ConversationTurn, PromptImage } from '../../ai';
import type { ConversationStore, StoredArtifact, StoredMessage } from '../../conversation-store';
import { ensureArtifactRefs, planCompaction, registryLine } from '../domain/contextAssembler';
import type { AuxModel } from '../domain/interfaces/auxModel.port';
import type { ContextSettings, ImageNote } from '../domain/interfaces/context.interface';
import {
  IMAGE_NOTE_SYSTEM,
  REWRITE_HISTORY_TURNS,
  REWRITE_SYSTEM,
  SUMMARY_MESSAGE_MAX_CHARS,
  SUMMARY_SYSTEM,
} from './constants/contextPrompts.constants';
import type { AuxTimeouts } from './interfaces/contextJobs.interface';

/**
 * Side jobs done with the aux model: image captions/OCR, follow-up query
 * rewriting and rolling auto-compaction. Every job is best effort: a failure
 * only means less context next time, never a failed answer.
 */
export class ContextJobs {
  private readonly compacting = new Set<string>();

  constructor(
    private readonly aux: AuxModel | null,
    private readonly store: ConversationStore,
    private readonly settings: ContextSettings,
    private readonly timeouts: AuxTimeouts,
  ) {}

  get enabled(): boolean {
    return this.aux !== null;
  }

  /** Caption + OCR per image (in parallel). A failed image gets an empty note. */
  async describeImages(images: PromptImage[], timeoutMs: number = this.timeouts.imageNoteMs): Promise<ImageNote[]> {
    const aux = this.aux;
    if (!aux || images.length === 0) return images.map(() => ({ caption: '', ocrText: '' }));
    return Promise.all(images.map(async (image, i) => {
      const reply = await attempt(() => aux.complete({ system: IMAGE_NOTE_SYSTEM, text: 'Describe this image.', images: [image], label: `aux-image-${i + 1}`, timeoutMs }));
      if (!reply.ok) {
        logger.warn(`[context] image note failed (${aux.name}): ${errorMessage(reply.error)}`);
        return { caption: '', ocrText: '' };
      }
      return parseImageNote(reply.value);
    }));
  }

  /** Writes captions/OCR of stored images (one query). */
  async enrichArtifacts(artifacts: { id: string; image: PromptImage }[]): Promise<void> {
    if (!this.aux || artifacts.length === 0) return;
    const notes = await this.describeImages(artifacts.map((a) => a.image));
    const updates = artifacts.map((a, i) => ({ id: a.id, caption: notes[i].caption, ocrText: notes[i].ocrText })).filter((u) => u.caption || u.ocrText);
    if (updates.length > 0) await this.store.enrichArtifacts(updates);
  }

  /** Standalone query for a pronoun-only follow-up; null when the aux model is off or fails. */
  async rewriteQuery(question: string, history: ConversationTurn[]): Promise<string | null> {
    const aux = this.aux;
    if (!aux) return null;
    const transcript = history.slice(-REWRITE_HISTORY_TURNS * 2).map((t) => `${t.role}: ${t.text.slice(0, 1500)}`).join('\n');
    const reply = await attempt(() => aux.complete({ system: REWRITE_SYSTEM, text: `${transcript}\n\nFollow-up: ${question}`, label: 'aux-rewrite', timeoutMs: this.timeouts.rewriteMs }));
    if (!reply.ok) {
      logger.warn(`[context] query rewrite failed: ${errorMessage(reply.error)}`);
      return null;
    }
    const query = reply.value.trim().replace(/^["']|["']$/g, '');
    return query || null;
  }

  /**
   * Rolling summary when the unsummarized part is too long. Runs after the
   * answer (no added latency); the original messages stay in the database.
   */
  async compactIfNeeded(conversationId: string, summary: string | null, summaryUptoSeq: number, messages: StoredMessage[], artifacts: StoredArtifact[]): Promise<boolean> {
    const aux = this.aux;
    if (!aux || this.compacting.has(conversationId)) return false;
    const plan = planCompaction(summaryUptoSeq, messages, artifacts, this.settings);
    if (!plan) return false;

    this.compacting.add(conversationId);
    try {
      const transcript = plan.toSummarize.map((m) => `[${m.seq}] ${m.role}${m.kind === 'chat' ? '' : ` (${m.kind})`}: ${m.text.slice(0, SUMMARY_MESSAGE_MAX_CHARS)}`).join('\n\n');
      const registry = artifacts.map(registryLine).join('\n');
      const text = [
        summary ? `PREVIOUS SUMMARY:\n${summary}` : 'PREVIOUS SUMMARY: (none)',
        `ARTIFACTS (ids to keep):\n${registry || '(none)'}`,
        `MESSAGES TO FOLD IN:\n${transcript}`,
      ].join('\n\n');
      const reply = await attempt(() => aux.complete({ system: SUMMARY_SYSTEM, text, label: `aux-compact-${conversationId.slice(0, 8)}`, timeoutMs: this.timeouts.compactMs }));
      if (!reply.ok || !reply.value.trim()) {
        logger.warn(`[context] compaction failed for ${conversationId}: ${reply.ok ? 'empty summary' : errorMessage(reply.error)} — retry next turn`);
        return false;
      }
      const next = ensureArtifactRefs(reply.value, plan.requiredRefs);
      const saved = await this.store.saveSummary(conversationId, next, plan.uptoSeq, summaryUptoSeq);
      logger.info(`[context] compacted ${conversationId} up to seq ${plan.uptoSeq} (${plan.toSummarize.length} messages, refs ${plan.requiredRefs.length})${saved ? '' : ' — skipped: newer summary exists'}`);
      return saved;
    } finally {
      this.compacting.delete(conversationId);
    }
  }
}

export function parseImageNote(raw: string): ImageNote {
  const json = extractJsonObject(raw) as { caption?: unknown; ocr_text?: unknown } | undefined;
  if (!json) return { caption: raw.trim().slice(0, 300), ocrText: '' };
  return {
    caption: typeof json.caption === 'string' ? json.caption.trim().slice(0, 500) : '',
    ocrText: typeof json.ocr_text === 'string' ? json.ocr_text.trim().slice(0, 1500) : '',
  };
}

