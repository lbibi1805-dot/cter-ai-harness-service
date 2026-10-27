export enum C4ApiPath {
  SKETCH = '/api/c4',
  RESUME = '/api/c4/resume',
}

/** Events of a streamed run (NDJSON, one per line); failures arrive as `{ "type": "error" }`. */
export enum C4StreamEvent {
  PROGRESS = 'progress',
  ANALYSIS = 'analysis',
  LEVEL = 'level',
  /** Last event: the full result, including `confirmation` when the run paused for the user. */
  DONE = 'done',
}
