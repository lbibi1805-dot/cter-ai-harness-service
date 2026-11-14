/** Events of a streamed `POST /api/chat` (NDJSON, one per line); failures arrive as `{ type: "error" }`. */
export enum ChatStreamEvent {
  DELTA = 'delta',
  RESET = 'reset',
  /** No text yet: `stage` says what the server is doing (see ChatProgressStage and ProgressStage). */
  PROGRESS = 'progress',
  DONE = 'done',
  /** 12/11 plan 08: questions found in the prompt `{ total, questions: [{ id, label }] }` (multi-question only). */
  ANSWER_PLAN = 'answer_plan',
  /** A new part of a sectioned answer `{ index, total }` (1-based); its text follows as deltas. */
  SECTION = 'section',
  /** The answer hit the output cap and is being continued `{ n }` (1-based). */
  CONTINUATION = 'continuation',
  /** Question ids still missing after the fix pass `{ missing: string[] }` (empty = complete). */
  COVERAGE = 'coverage',
}

/** `progress` stages sent by the HTTP layer itself (the answer pipeline adds `answering` and `agent-tool`). */
export enum ChatProgressStage {
  /** The request is accepted; the prompt (RAG retrieval) is being built. */
  PREPARING = 'preparing',
}

export enum ChatApiPath {
  ASK = '/api/chat',
  STATUS = '/api/chat/status',
  /** Upload-first images: `{ images: [{ imageId, … }] }`, then `imageIds` in /api/chat and /api/c4. */
  IMAGES = '/api/chat/images',
}
