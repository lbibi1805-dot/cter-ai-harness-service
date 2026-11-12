import type { AnswerTimings } from '../../../ai';

/** DIAGRAM_SYNTAX_GUARD_ENABLED / DIAGRAM_SYNTAX_MAX_REPAIRS. */
export interface DiagramGuardSettings {
  enabled: boolean;
  maxRepairs: number;
}

export type DiagramGuardTimings = Pick<AnswerTimings, 'diagramValidateMs' | 'diagramBlocks' | 'diagramRepairs' | 'diagramRepairFailed'>;

export interface DiagramGuardOutcome {
  text: string;
  /** Absent when the answer had no PlantUML block. */
  timings?: DiagramGuardTimings;
}

/** Counters since start. */
export interface DiagramGuardStats {
  answers: number;
  blocks: number;
  repairs: number;
  repairFailed: number;
  /** Answers whose blocks were not checked (deadline too close). */
  skipped: number;
}
