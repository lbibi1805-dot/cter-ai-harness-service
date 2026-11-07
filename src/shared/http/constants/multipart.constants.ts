export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

/** One request with many files (folder upload); formidable would otherwise cap the total at one file's limit. */
export const MAX_UPLOAD_TOTAL_BYTES = 200 * 1024 * 1024;
