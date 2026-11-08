/** How a chat question entered Essay Mode. */
export enum EssayTrigger {
  /** `mode: "essay"` in the chat body. */
  BODY_MODE = 'body-mode',
  /** The question started with `/essay`. */
  COMMAND = 'command',
  /** ESSAY_MODE_ENABLED rule detector: exam verb + "(N điểm)". */
  AUTO = 'auto',
}

/** Exam verbs and what each expects (15 §4.1). */
export enum EssayVerb {
  LIST = 'list',
  EXPLAIN = 'explain',
  ANALYZE = 'analyze',
  COMPARE = 'compare',
  EVALUATE = 'evaluate',
}

/** Request modes in the chat body that are not AnswerMode values. */
export enum EssayRequestMode {
  ESSAY = 'essay',
}

/** LLM call purposes recorded in latency entries. */
export enum EssayCallPurpose {
  ANALYSIS = 'essay-analysis',
  WRITE = 'essay',
  SELF_CHECK = 'essay-self-check',
}
