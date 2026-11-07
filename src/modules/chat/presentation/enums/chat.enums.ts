/** Events of a streamed `POST /api/chat` (NDJSON, one per line); failures arrive as `{ type: "error" }`. */
export enum ChatStreamEvent {
  DELTA = 'delta',
  RESET = 'reset',
  /** No text yet: `stage` says what the server is doing (see ChatProgressStage and ProgressStage). */
  PROGRESS = 'progress',
  DONE = 'done',
}

/** `progress` stages sent by the HTTP layer itself (the answer pipeline adds `answering` and `agent-tool`). */
export enum ChatProgressStage {
  /** The request is accepted; the prompt (RAG retrieval) is being built. */
  PREPARING = 'preparing',
}

export enum ChatApiPath {
  ASK = '/api/chat',
  STATUS = '/api/chat/status',
}
