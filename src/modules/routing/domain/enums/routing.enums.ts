/** What a request asks for (note 05 §2). */
export enum RequestIntent {
  QA = 'qa',
  C4_GENERATE = 'c4_generate',
  C4_REVIEW = 'c4_review',
  C4_GENERATE_AND_REVIEW = 'c4_generate_and_review',
  /** Generate from a base c4_spec picked by the artifact resolver; the new spec continues its version chain. */
  C4_REVISE = 'c4_revise',
}

/** How the intent was decided (`intent` stream event, `messages.intent` monitoring). */
export enum IntentSource {
  /** The client sent `intent` (not "auto"). */
  EXPLICIT = 'explicit',
  /** `--review` flag. */
  FLAG = 'flag',
  /** Keyword / image / existing-design rules. */
  RULE = 'rule',
  /** The combined aux call (intent + refs). */
  AUX = 'aux',
  /** Nothing decided: the safe default. */
  DEFAULT = 'default',
}

/** `intent` field of POST /api/c4 ("auto" = let the router decide). */
export enum ClientIntent {
  AUTO = 'auto',
  GENERATE = 'generate',
  REVIEW = 'review',
  GENERATE_AND_REVIEW = 'generate_and_review',
  REVISE = 'revise',
}
