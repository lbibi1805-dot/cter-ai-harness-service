/** What a question in a prompt asks for (12/11 plan 08): drives whether its answer length is enforced. */
export enum QuestionKind {
  /** Explain / analyse / compare: a minimum length applies. */
  ESSAY = 'essay',
  /** Definition, single fact, short list: complete sentences, no length forced. */
  SHORT = 'short',
  /** Calculation: no length forced. */
  CALC = 'calc',
  /** Drawing: no length forced (the diagram is the answer). */
  DIAGRAM = 'diagram',
}

/** Which marker family split the prompt. */
export enum QuestionMarker {
  NAMED = 'named',
  NUMBERED = 'numbered',
  LETTERED = 'lettered',
  QUESTION_MARK = 'question-mark',
  NONE = 'none',
}
