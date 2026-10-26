/** Base64 screenshots are ~1.4x the PNG size; 20 MB fits a few full-HD captures. */
export const MAX_CHAT_BODY_BYTES = 20 * 1024 * 1024;

export const MAX_CHAT_IMAGES = 4;

/** Upper bound on the raw `history` array; the server keeps only the newest turns (see MAX_HISTORY_TURNS). */
export const MAX_RAW_HISTORY_TURNS = 200;

export const IMAGE_MIME_PREFIX = 'image/';

export const DATA_URL = /^data:([^;,]+);base64,([\s\S]*)$/;
