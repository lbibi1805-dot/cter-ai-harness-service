/** Earlier turns kept per request (the newest ones). */
export const MAX_HISTORY_TURNS = 20;

/** A longer turn is cut to this many characters. */
export const MAX_HISTORY_TURN_CHARS = 6_000;

/**
 * HISTORY_ASSISTANT_TURN_MAX_CHARS (08 Bước 5): the NEWEST assistant turn keeps up to this many characters, so a
 * "làm tiếp" / follow-up sees the long answer it continues; older turns keep MAX_HISTORY_TURN_CHARS.
 */
export const DEFAULT_HISTORY_ASSISTANT_TURN_MAX_CHARS = 12_000;

/** Total characters of history sent to the model; the oldest turns are dropped first. */
export const MAX_HISTORY_CHARS = 30_000;

export const TRUNCATED_TURN_SUFFIX = '\n…[truncated]';
