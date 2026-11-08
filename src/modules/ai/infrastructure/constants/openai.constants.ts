export const IMAGE_DETAIL = 'auto' as const;

/** Responses API stream event carrying a chunk of the answer text. */
export const RESPONSES_TEXT_DELTA_EVENT = 'response.output_text.delta';

/** Responses API stream event carrying the final response (with usage). */
export const RESPONSES_COMPLETED_EVENT = 'response.completed';

/** Models that take `reasoning_effort` / `reasoning.effort`. */
export const OPENAI_REASONING_MODEL_PATTERN = /^(o\d|gpt-5|gpt-6|codex)/i;

export const CONVERSATION_CACHE_KEY_PREFIX = 'conv-';

export const PROMPT_VERSION_CACHE_KEY_PREFIX = 'pv-';

export const PROMPT_VERSION_HASH_CHARS = 16;

/** OpenAI rejects longer `prompt_cache_key` values. */
export const PROMPT_CACHE_KEY_MAX_CHARS = 64;
