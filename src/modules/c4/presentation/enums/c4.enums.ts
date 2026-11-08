export enum C4ApiPath {
  SKETCH = '/api/c4',
  RESUME = '/api/c4/resume',
  /** PlantUML source → PNG preview (chat answers that edit a diagram). */
  RENDER = '/api/c4/render',
}

/** Events of a streamed run (NDJSON, one per line); failures arrive as `{ "type": "error" }`. */
export enum C4StreamEvent {
  PROGRESS = 'progress',
  /** Intent router decision: {intent, confidence, source}. */
  INTENT = 'intent',
  /** The problem as understood: {brief: {systemName, summary[], actors[], externalSystems[], levels[]}}. */
  BRIEF = 'brief',
  /** Paused for the user: {sessionId, summary[], questions[], expiresInSec}; answer with POST /api/c4/resume. */
  CLARIFY = 'clarify',
  ANALYSIS = 'analysis',
  LEVEL = 'level',
  /** Review markdown as it is written: {text}. */
  REVIEW_DELTA = 'review_delta',
  /** The full review (fixed frame) and its artifact: {review: {markdown, artifactId?, alias?}}. */
  REVIEW_DONE = 'review_done',
  /** Last event: the full result, including `confirmation` when the run paused for the user. */
  DONE = 'done',
}
