/** Limits of the Starlinguide Partner API `POST /partner/context-files` (starlinguide/partner-context-upload-api.md). */
export const STARLINGUIDE_MAX_EMAILS = 20;
export const STARLINGUIDE_MAX_FILES_PER_REQUEST = 20;
export const STARLINGUIDE_MAX_FILE_BYTES = 20 * 1024 * 1024;
/** The partner caps the body at 30 MB; 2 MB stay free for the multipart framing and the email fields. */
export const STARLINGUIDE_MAX_REQUEST_BYTES = 28 * 1024 * 1024;

export const STARLINGUIDE_UPLOAD_PATH = '/partner/context-files';
export const STARLINGUIDE_SECRET_HEADER = 'X-Partner-Secret';

/** Simple shape check only; the partner matches the exact (case-sensitive) address. */
export const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
/** `STARLINGUIDE_EMAILS` separators: comma, semicolon, newline. */
export const EMAIL_SEPARATORS = /[,;\n\r]+/;

export const PARTNER_INDEX_DIGITS = 4;
export const PARTNER_SEQ_DIGITS = 2;
