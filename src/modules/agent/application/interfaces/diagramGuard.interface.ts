import type { AnswerTimings } from '../../../ai';

/** DIAGRAM_SYNTAX_GUARD_ENABLED / DIAGRAM_SYNTAX_MAX_REPAIRS. */
export interface DiagramGuardSettings {
  enabled: boolean;
  maxRepairs: number;
  /** DIAGRAM_CONNECTIVITY_CHECK (default true): the validator also lints connectivity (plan 04 §4.3). */
  connectivityCheck?: boolean;
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
  /** Blocks with an orphan element (plan 04 §4.3); /c4 adds levels whose first spec had one. */
  orphanFound: number;
  /** Of those, blocks (levels) whose orphans the repair removed. */
  orphanRepaired: number;
  /** Connectivity errors found (orphans, split diagrams, one-sided queues). */
  connectivityErrors: number;
}
