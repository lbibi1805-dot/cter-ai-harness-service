/** Search queries are short; the cap only guards against accidental huge bodies. */
export const MAX_RETRIEVE_BODY_BYTES = 64 * 1024;

export const MAX_RETRIEVE_TOP_K = 50;
