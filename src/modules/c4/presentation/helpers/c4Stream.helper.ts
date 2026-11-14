import type { NdjsonStream } from '../../../../shared/http/ndjson';
import type { C4EventSink } from '../../application/interfaces/c4Sketch.interface';
import { C4StreamEvent } from '../enums/c4.enums';
import { toC4AnalysisDto, toC4BriefDto, toC4ClarifyDto, toC4DiscussionDto, toC4IntentDto, toC4LevelDto, toC4ReviewDto } from '../mappers/c4.mapper';

/** Writes a run's progress as NDJSON events, each image as soon as it is rendered, the review as it is written. */
export function toStreamSink(out: NdjsonStream): C4EventSink {
  return {
    progress: (message) => out.write({ type: C4StreamEvent.PROGRESS, message }),
    intent: (decision) => out.write({ type: C4StreamEvent.INTENT, ...toC4IntentDto(decision) }),
    brief: (brief) => out.write({ type: C4StreamEvent.BRIEF, brief: toC4BriefDto(brief) }),
    clarify: (clarify) => out.write({ type: C4StreamEvent.CLARIFY, ...toC4ClarifyDto(clarify) }),
    analysis: (plan, knowledgeSources) => out.write({ type: C4StreamEvent.ANALYSIS, ...toC4AnalysisDto(plan, knowledgeSources) }),
    level: (result) => out.write({ type: C4StreamEvent.LEVEL, ...toC4LevelDto(result) }),
    reviewDelta: (text) => out.write({ type: C4StreamEvent.REVIEW_DELTA, text }),
    reviewDone: (review) => out.write({ type: C4StreamEvent.REVIEW_DONE, review: toC4ReviewDto(review) }),
    discussionDelta: (text) => out.write({ type: C4StreamEvent.DISCUSSION_DELTA, text }),
    discussionDone: (discussion) => out.write({ type: C4StreamEvent.DISCUSSION_DONE, discussion: toC4DiscussionDto(discussion) }),
  };
}
