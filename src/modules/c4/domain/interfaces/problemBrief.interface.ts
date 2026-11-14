import type { BriefSource, C4Level, C4Slot, CloudScope, SlotImpact } from '../enums/c4.enums';

/** One brief field with how sure the extraction is (0..1) and where it came from. */
export interface BriefField<T> {
  value: T;
  confidence: number;
  source: BriefSource;
}

export interface BriefRubricItem {
  criterion: string;
  weight: number;
}

/** The problem statement as structured data (note 05 §4): built from the images and the typed text. */
export interface ProblemBrief {
  systemName: BriefField<string>;
  /** What is inside the system being designed. */
  systemBoundary: BriefField<string>;
  actors: BriefField<string[]>;
  /** Empty value with a high confidence = "surely none". */
  externalSystems: BriefField<string[]>;
  functionalReqs: string[];
  nonFunctionalReqs: string[];
  techConstraints: BriefField<string[]>;
  /** Deliverables: the C4 levels to draw. */
  levels: BriefField<C4Level[]>;
  rubric: BriefRubricItem[];
  /**
   * Plan 04 §5.2 (T5): statement phrases that point to (or away from) multi-tenancy ("SaaS for many
   * universities", "internal system of company X"). Optional: briefs saved before 13/11 lack it.
   */
  tenancySignals?: BriefField<string[]>;
  /** Plan 04 §5.2 (T1): where the system runs; `unknown` with confidence 0 when the statement says nothing. */
  cloudScope?: BriefField<CloudScope>;
  /** Plan 04 §5.2 (T7): users, peak load, growth ("10k concurrent users at 9am"). */
  scaleHints?: string[];
  /** The user's own design among the images (0-based indexes into the request images). */
  userDesign: { present: boolean; imageIndexes: number[] };
}

/** Fields a source states explicitly (typed text, answers): they override the brief. */
export type BriefOverride = Partial<Omit<ProblemBrief, 'userDesign'>> & { userDesign?: ProblemBrief['userDesign'] };

/** One fixed slot of the gap analysis. */
export interface SlotRule {
  slot: C4Slot;
  impact: SlotImpact;
  question: string;
  /** Options offered with the question (buttons in the client). */
  options?: readonly string[];
}

/** One question of the clarify message: always with the default used when the user does not answer it. */
export interface ClarifyQuestion {
  slot: C4Slot;
  question: string;
  default: string;
  options?: string[];
}

export interface GapAnalysis {
  questions: ClarifyQuestion[];
  /** Set when nothing is asked on purpose. */
  skipped?: string;
}

export interface GapAnalysisOptions {
  fast: boolean;
  /** Review of a design the user sent (or one picked from the conversation): skip the questions. */
  reviewWithDesign: boolean;
  revise: boolean;
}

/** Answers per slot (free text); slots not present keep their default. */
export type SlotAnswers = Partial<Record<C4Slot, string>>;
