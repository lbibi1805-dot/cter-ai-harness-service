/** Proxy download route (presentation owns the route; the service only builds the link). */
export const CAPTURE_FILES_PATH = '/api/captures/files/';

/** Random part of an image name: 3 bytes = 6 hex chars. */
export const CAPTURE_IMAGE_ID_BYTES = 3;

export const DEFAULT_CAPTURE_URL_TTL_SECONDS = 60 * 60;
export const DEFAULT_CAPTURE_MAX_IMAGE_MB = 15;
export const DEFAULT_CAPTURE_STORAGE_DIR = './data/capture-store';
