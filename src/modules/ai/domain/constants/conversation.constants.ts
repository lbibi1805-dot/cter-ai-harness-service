/** Earlier turns kept per request (the newest ones). */
export const MAX_HISTORY_TURNS = 20;

/** A longer turn is cut to this many characters. */
export const MAX_HISTORY_TURN_CHARS = 6_000;

/** Total characters of history sent to the model; the oldest turns are dropped first. */
export const MAX_HISTORY_CHARS = 30_000;

export const TRUNCATED_TURN_SUFFIX = '\n…[truncated]';
