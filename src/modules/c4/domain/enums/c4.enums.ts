/** C4 diagram levels the sketcher can draw (C4-PlantUML include per level). */
export enum C4Level {
  CONTEXT = 'context',
  CONTAINER = 'container',
  COMPONENT = 'component',
  SEQUENCE = 'sequence',
}

export enum C4ElementKind {
  PERSON = 'person',
  SYSTEM = 'system',
  CONTAINER = 'container',
  COMPONENT = 'component',
  SYSTEM_BOUNDARY = 'system_boundary',
  CONTAINER_BOUNDARY = 'container_boundary',
  BOUNDARY = 'boundary',
}

export enum C4ElementVariant {
  STANDARD = 'standard',
  DB = 'db',
  QUEUE = 'queue',
}

/** Layout hint, rendered as Rel_U/Rel_D/Rel_L/Rel_R. */
export enum C4Direction {
  UP = 'U',
  DOWN = 'D',
  LEFT = 'L',
  RIGHT = 'R',
}

/** Where a brief field came from: typed text wins over images (note 05 §4); answers and defaults come later. */
export enum BriefSource {
  IMAGE = 'image',
  TEXT = 'text',
  USER_ANSWER = 'user',
  DEFAULT = 'default',
}

/** Fixed C4 slots the gap analysis checks (note 05 §5). */
export enum C4Slot {
  SYSTEM_BOUNDARY = 'systemBoundary',
  ACTORS = 'actors',
  EXTERNAL_SYSTEMS = 'externalSystems',
  LEVELS = 'levels',
  TECH_CONSTRAINTS = 'techConstraints',
  RUBRIC = 'rubric',
}

export enum SlotImpact {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/** Why the clarify step was skipped. */
export enum ClarifySkipReason {
  FAST = 'fast',
  /** Every high/medium slot has confidence ≥ 0.6. */
  CONFIDENT = 'confident',
  /** c4_review with the user's design present: nothing to draw, nothing to ask. */
  REVIEW_WITH_DESIGN = 'review_with_design',
  /** c4_revise: the base design already settles the slots. */
  REVISE = 'revise',
}

/** Steps of the C4 workflow (note 05 §3); `pendingC4.step` while paused. */
export enum C4WorkflowStep {
  INTAKE = 'intake',
  EXTRACT = 'extract',
  GAP_ANALYSIS = 'gap_analysis',
  CLARIFY = 'clarify',
  ROUTE = 'route',
  GENERATE = 'generate',
  VALIDATE_RENDER = 'validate_render',
  CRITIQUE = 'critique',
  REVIEW = 'review',
  RESPOND = 'respond',
}

/** What a review evaluates. */
export enum DesignSourceKind {
  /** The user's own design, sent as an image (read into a spec by vision). */
  USER_IMAGE = 'user_image',
  /** A c4_spec artifact of the conversation, picked by the artifact resolver. */
  SPEC_ARTIFACT = 'c4_spec',
  /** The spec this run just generated (c4_generate_and_review). */
  GENERATED = 'generated',
}
