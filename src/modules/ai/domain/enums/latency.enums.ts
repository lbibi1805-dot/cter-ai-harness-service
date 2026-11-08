/** How one adapter attempt ended (`AnswerTimings.attempts[].outcome`). */
export enum AttemptOutcome {
  OK = 'ok',
  RATE_LIMITED = 'rate-limited',
  TRANSIENT = 'transient',
  PERMANENT = 'permanent',
  FATAL = 'fatal',
  /** First-token, idle or per-attempt timeout (the request was aborted). */
  TIMEOUT = 'timeout',
  /** Not tried: the model's circuit breaker was open. */
  CIRCUIT_OPEN = 'circuit-open',
}

/** Which entry point an invocation came through; recorded per latency entry. */
export enum InvocationKind {
  /** `answer()` with a stream (chat API). */
  STREAM = 'stream',
  /** `answer()` without a stream (polling flows, Canvas replies). */
  ANSWER = 'answer',
  /** `answerPrepared()` (C4 sketcher, context aux jobs). */
  PREPARED = 'prepared',
}

/** Failure kinds a latency entry can carry besides FailureKind. */
export enum InvocationErrorKind {
  DEADLINE = 'deadline',
}

/** GEMINI_THINKING_LEVEL. */
export enum GeminiThinkingLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/** OPENAI_REASONING_EFFORT (only sent to reasoning models). */
export enum OpenAIReasoningEffort {
  NONE = 'none',
  MINIMAL = 'minimal',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/** OPENAI_SERVICE_TIER (unset = the account default). */
export enum OpenAIServiceTier {
  AUTO = 'auto',
  DEFAULT = 'default',
  FLEX = 'flex',
  PRIORITY = 'priority',
}

/** OPENAI_PROMPT_CACHE_KEY: what `prompt_cache_key` is derived from. */
export enum PromptCacheKeyMode {
  /** `AIRequest.cacheKey` (the conversation id); falls back to the prompt version when absent. */
  CONVERSATION = 'conversation',
  /** A hash of the system prompt: every conversation sharing the prompt shares the key. */
  PROMPT_VERSION = 'prompt_version',
  OFF = 'off',
}
