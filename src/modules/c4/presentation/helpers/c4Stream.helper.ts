import type { NdjsonStream } from '../../../../shared/http/ndjson';
import type { C4EventSink } from '../../application/interfaces/c4Sketch.interface';
import { C4StreamEvent } from '../enums/c4.enums';
import { toC4AnalysisDto, toC4LevelDto } from '../mappers/c4.mapper';

/** Writes a run's progress as NDJSON events, each image as soon as it is rendered. */
export function toStreamSink(out: NdjsonStream): C4EventSink {
  return {
    progress: (message) => out.write({ type: C4StreamEvent.PROGRESS, message }),
    analysis: (plan, knowledgeSources) => out.write({ type: C4StreamEvent.ANALYSIS, ...toC4AnalysisDto(plan, knowledgeSources) }),
    level: (result) => out.write({ type: C4StreamEvent.LEVEL, ...toC4LevelDto(result) }),
  };
}
