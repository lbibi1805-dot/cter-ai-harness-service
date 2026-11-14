import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience';
import { briefStatement, describeConnectivity, ensureDiscussionFrame, type ProblemBrief } from '../domain';
import { C4FlowProgress, C4Step } from './constants/c4Sketch.constants';
import type { C4ModelCaller } from './c4ModelCaller';
import type { C4PromptBuilder } from './c4Prompts.builder';
import type { C4DiscussionResult, C4LevelResult, C4RunContext } from './interfaces/c4Sketch.interface';

/** What the discussion is about: the brief and the levels the run drew (final specs). */
export interface C4DiscussionInput {
  brief: ProblemBrief;
  typedText: string;
  levels: C4LevelResult[];
}

/**
 * Discussion writer (12/11 plan 04 §5.3): after the critic, one markdown call on the final specs (with their
 * instances) and the connectivity findings left, streamed as `discussion_delta`, then put into the fixed
 * seven-topic frame by code (a missing topic gets "Chưa phân tích", never a second call).
 */
export class C4DiscussionService {
  constructor(
    private readonly calls: C4ModelCaller,
    private readonly prompts: C4PromptBuilder,
  ) {}

  /** True when there is a drawn design to discuss. */
  static hasDesign(levels: readonly C4LevelResult[]): boolean {
    return levels.some((l) => l.spec);
  }

  /** Null when the writer failed or answered nothing. */
  async discuss(ctx: C4RunContext, input: C4DiscussionInput): Promise<C4DiscussionResult | null> {
    const drawn = input.levels.filter((l) => l.spec);
    if (drawn.length === 0) return null;
    ctx.sink?.progress(C4FlowProgress.DISCUSSION);
    const specs = JSON.stringify(drawn.map((l) => ({ level: l.level, spec: l.spec })));
    const findings = drawn.flatMap((l) => describeConnectivity([...(l.connectivity?.errors ?? []), ...(l.connectivity?.warnings ?? [])]).map((line) => `${l.level}: ${line}`));
    const text = this.prompts.discussion(briefStatement(input.brief, input.typedText), specs, findings);
    const answer = await attempt(() => this.calls.stream(
      ctx, text, [], C4Step.DISCUSSION, this.prompts.discussionSystem(), (delta) => ctx.sink?.discussionDelta?.(delta),
    ));
    if (!answer.ok || !answer.value.trim()) {
      logger.warn(`[c4] ${ctx.label} discussion failed: ${answer.ok ? 'empty answer' : errorMessage(answer.error)}`);
      return null;
    }
    return { markdown: ensureDiscussionFrame(answer.value) };
  }
}
