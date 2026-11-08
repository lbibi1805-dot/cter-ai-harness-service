import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience';
import type { PromptImage } from '../../ai';
import { ArtifactKind, type StoredArtifact } from '../../conversation-store';
import type { CitedChunk } from '../../retrieval';
import { briefStatement, DesignSourceKind, ensureReviewFrame, type ProblemBrief } from '../domain';
import { C4FlowProgress, C4Step, DESIGN_UNREADABLE, DesignLabels, PNG_MIME_TYPE } from './constants/c4Sketch.constants';
import type { C4ModelCaller } from './c4ModelCaller';
import type { C4PromptBuilder } from './c4Prompts.builder';
import type { C4ConversationRecorder, C4DesignRef, C4LevelResult, C4ReviewResult, C4RunContext } from './interfaces/c4Sketch.interface';

/** What a review is about. */
export interface C4ReviewInput {
  brief: ProblemBrief;
  typedText: string;
  /** Request images; the brief's `userDesign.imageIndexes` point into them. */
  images: PromptImage[];
  /** Design picked by the artifact resolver (owner signal). */
  design?: C4DesignRef | null;
  /** c4_generate_and_review: the levels this run just drew. */
  generated?: C4LevelResult[];
  knowledge: CitedChunk[];
}

interface DesignUnderReview {
  source: DesignSourceKind;
  label: string;
  json: string;
  images: PromptImage[];
}

/**
 * Review mode (note 05 §6): design source (fresh spec | the user's design image → spec by vision | the
 * c4_spec the resolver picked) → evaluator with the knowledge base's rules and rubric in its system prompt
 * → markdown streamed as `review_delta`, then put into the fixed frame.
 */
export class C4ReviewService {
  constructor(
    private readonly calls: C4ModelCaller,
    private readonly prompts: C4PromptBuilder,
    private readonly recorder: C4ConversationRecorder | undefined,
  ) {}

  /** True when there is something to review without drawing first. */
  static hasDesign(brief: ProblemBrief, images: PromptImage[], design?: C4DesignRef | null): boolean {
    return (brief.userDesign.present && brief.userDesign.imageIndexes.some((i) => i < images.length)) || !!design;
  }

  /** Null when there is no design to review or the evaluator failed. */
  async review(ctx: C4RunContext, input: C4ReviewInput): Promise<C4ReviewResult | null> {
    const design = await this.designOf(ctx, input);
    if (!design) return null;
    ctx.sink?.progress(C4FlowProgress.REVIEW);
    const text = this.prompts.review(briefStatement(input.brief, input.typedText), design.json, design.label);
    const answer = await attempt(() => this.calls.stream(
      ctx, text, design.images, C4Step.REVIEW, this.prompts.reviewSystem(input.knowledge), (delta) => ctx.sink?.reviewDelta?.(delta),
    ));
    if (!answer.ok || !answer.value.trim()) {
      logger.warn(`[c4] ${ctx.label} review failed: ${answer.ok ? 'empty answer' : errorMessage(answer.error)}`);
      return null;
    }
    return { markdown: ensureReviewFrame(answer.value), designSource: design.source, designLabel: design.label };
  }

  private async designOf(ctx: C4RunContext, input: C4ReviewInput): Promise<DesignUnderReview | null> {
    if (input.generated?.some((l) => l.spec)) {
      const drawn = input.generated.filter((l) => l.spec);
      return {
        source: DesignSourceKind.GENERATED,
        label: DesignLabels.GENERATED,
        json: JSON.stringify(drawn.map((l) => ({ level: l.level, spec: l.spec }))),
        images: drawn.filter((l) => l.png).map((l) => ({ data: l.png!, mimeType: PNG_MIME_TYPE })),
      };
    }
    const own = input.brief.userDesign.present ? input.brief.userDesign.imageIndexes.map((i) => input.images[i]).filter(Boolean) : [];
    if (own.length > 0) return this.readImages(ctx, own, DesignLabels.USER_IMAGE);
    const picked = input.design;
    if (!picked) return null;
    const label = `[${picked.alias}] ${picked.label}`;
    if (picked.kind === ArtifactKind.USER_IMAGE) {
      const images = this.recorder?.loadImages && picked.objectKey
        ? await this.recorder.loadImages([{ id: picked.artifactId, objectKey: picked.objectKey, mime: picked.mime ?? null } as StoredArtifact])
        : [];
      return images.length > 0 ? this.readImages(ctx, images, label) : null;
    }
    return { source: DesignSourceKind.SPEC_ARTIFACT, label, json: JSON.stringify(picked.dataJson ?? {}), images: [] };
  }

  /** The user's design as drawn → spec JSON (vision); the evaluator also gets the images. */
  private async readImages(ctx: C4RunContext, images: PromptImage[], label: string): Promise<DesignUnderReview> {
    ctx.sink?.progress(C4FlowProgress.DESIGN_READ);
    const read = await attempt(() => this.calls.askJson(ctx, this.prompts.designRead(), images, C4Step.DESIGN_READ));
    if (!read.ok) logger.warn(`[c4] ${ctx.label} design transcription failed: ${errorMessage(read.error)}`);
    return { source: DesignSourceKind.USER_IMAGE, label, json: read.ok ? JSON.stringify(read.value) : DESIGN_UNREADABLE, images };
  }
}
