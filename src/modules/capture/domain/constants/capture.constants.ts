/** Folder = who took the photos: lowercase ASCII letters, digits, `-`, `_` (normalized from what the user typed). */
export const CAPTURE_FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export const CAPTURE_FOLDER_MAX_LENGTH = 32;

/** Batch numbers ("bài #7") run 1..9999 per folder; keys pad them to 4 digits so they sort. */
export const CAPTURE_MAX_BATCH_INDEX = 9999;
export const CAPTURE_INDEX_DIGITS = 4;

/** Image file names inside a batch: `{seq:02}-{6 hex}.{ext}` (seq keeps the upload order). */
export const CAPTURE_IMAGE_NAME_PATTERN = /^(\d{2,4})-[a-f0-9]{6}\.(jpg|png|webp|gif)$/;
export const CAPTURE_SEQ_DIGITS = 2;

/** One exercise rarely needs more pages; protects the bucket from a runaway upload loop. */
export const CAPTURE_MAX_IMAGES_PER_BATCH = 60;
