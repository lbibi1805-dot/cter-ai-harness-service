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

/** How a container's instance count changes (12/11 plan 04 §5.1, T7). */
export enum C4Scaling {
  FIXED = 'fixed',
  /** Horizontal pod autoscaler (Kubernetes) or any autoscaling group. */
  HPA = 'hpa',
  SERVERLESS = 'serverless',
}

/** Connectivity rules C1–C9 (12/11 plan 04 §4.2, B1): "every box connected, and connected enough". */
export enum ConnectivityCode {
  /** C1: an element with no relationship (error). */
  ORPHAN_ELEMENT = 'ORPHAN_ELEMENT',
  /** C2: the diagram falls apart into separate clusters (error). */
  DISCONNECTED_GRAPH = 'DISCONNECTED_GRAPH',
  /** C3: a database no service or component uses (error). */
  DB_WITHOUT_OWNER = 'DB_WITHOUT_OWNER',
  /** C4: a microservice without its own database (warning). */
  SERVICE_WITHOUT_DB = 'SERVICE_WITHOUT_DB',
  /** C5: one database used by several services in a microservice design (warning). */
  SHARED_DB = 'SHARED_DB',
  /** C6: a client reaches a backend service around the gateway (warning). */
  GATEWAY_COVERAGE = 'GATEWAY_COVERAGE',
  /** C7: a queue/broker without a producer or without a consumer (error). */
  QUEUE_ONE_SIDED = 'QUEUE_ONE_SIDED',
  /** C8: a component that calls nothing, or no component reaching outside its container (warning). */
  COMPONENT_NO_OUTBOUND = 'COMPONENT_NO_OUTBOUND',
  /** C9: an internal container without an instance count / autoscaling range (warning). */
  MISSING_INSTANCES = 'MISSING_INSTANCES',
}

/** Where the system runs (brief slot `deployment_target`, plan 04 §5.2). */
export enum CloudScope {
  FULL_CLOUD = 'full-cloud',
  HYBRID = 'hybrid',
  ON_PREM = 'on-prem',
  UNKNOWN = 'unknown',
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
  /** Multi-tenancy (plan 04 §5.2 / 05): low impact, asked only when the statement's signals are unclear. */
  TENANCY = 'tenancy',
  /** Cloud / hybrid / on-prem (plan 04 §5.2, T1): low impact, asked only when the statement is unclear. */
  DEPLOYMENT_TARGET = 'deployment_target',
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
  /** Design discussion T1–T7 (plan 04 §5.3). */
  DISCUSSION = 'discussion',
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
