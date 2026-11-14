/** Stages of a streamed answer that carry no text yet; the transport maps them to its own progress event. */
export enum ProgressStage {
  /** Prompt preparation is done and the model call has started. */
  ANSWERING = 'answering',
  /** The agent is running a tool; `detail` is the tool name. */
  AGENT_TOOL = 'agent-tool',
  /** The answer is written; its PlantUML blocks are being rendered/repaired (12/11 plan 03 §5). */
  VALIDATING_DIAGRAM = 'validating-diagram',
}

/** Structural events of a long answer (12/11 plan 08); text still flows as deltas. */
export enum AnswerEventType {
  /** The questions found in the prompt: `{ total, questions: [{ id, label }] }`. */
  ANSWER_PLAN = 'answer_plan',
  /** A new part of a sectioned answer starts: `{ index, total }` (1-based). */
  SECTION = 'section',
  /** The answer was cut by the output cap and is being continued: `{ n }` (1-based). */
  CONTINUATION = 'continuation',
  /** Question ids still missing after the fix pass: `{ missing }` (empty = complete). */
  COVERAGE = 'coverage',
}
