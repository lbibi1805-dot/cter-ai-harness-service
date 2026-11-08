/** Prefix that marks the OpenRouter step in logs and fallback messages. */
export const OPENROUTER_LOG_PREFIX = 'openrouter:';

/** Separates route and model in circuit-breaker keys. */
export const CIRCUIT_KEY_SEPARATOR = '|';

/** Longest circuit reason kept (error messages can carry whole response bodies). */
export const CIRCUIT_REASON_MAX_CHARS = 200;

export const LATENCY_LOG_TAG = '[latency]';
