export const CAPTURE_DEFAULT_LIST_LIMIT = 20;
export const CAPTURE_MAX_LIST_LIMIT = 100;

/** `{ "folder": "…" }` is tiny. */
export const CAPTURE_JSON_BODY_LIMIT = 4 * 1024;

/** Photos never change under a name (names are unique), so a short private cache is safe. */
export const CAPTURE_PRIVATE_CACHE = 'private, max-age=600';
