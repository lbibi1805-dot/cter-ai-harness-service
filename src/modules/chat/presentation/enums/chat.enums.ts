/** Events of a streamed `POST /api/chat` (NDJSON, one per line); failures arrive as `{ type: "error" }`. */
export enum ChatStreamEvent {
  DELTA = 'delta',
  RESET = 'reset',
  DONE = 'done',
}

export enum ChatApiPath {
  ASK = '/api/chat',
  STATUS = '/api/chat/status',
}
