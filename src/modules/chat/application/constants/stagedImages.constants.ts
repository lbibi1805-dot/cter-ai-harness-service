import { ObjectPrefix } from '../../../../shared/storage';

/** `tmp/uploads/<imageId>`: under `tmp/`, so the bucket lifecycle rule (1 day) also removes anything a sweep missed. */
export const STAGED_IMAGE_PREFIX = `${ObjectPrefix.TMP}uploads/`;

/** CHAT_UPLOAD_TTL_MS default: an uploaded image must be used by a chat/C4 request within 1 hour. */
export const DEFAULT_CHAT_UPLOAD_TTL_MS = 60 * 60 * 1000;

/** Uploads tracked in RAM; past it the oldest is forgotten and its object deleted. */
export const STAGED_IMAGES_MAX_ENTRIES = 500;

/** The opportunistic sweep (only on upload requests, never on a timer) runs at most this often. */
export const STAGED_SWEEP_MIN_INTERVAL_MS = 60 * 1000;

/** An image whose longest side is over this is downscaled server-side… */
export const STAGED_RESIZE_THRESHOLD_PX = 2048;

/** …to this longest side (Claude's/Gemini's sweet spot; also what the client compressor targets). */
export const STAGED_RESIZE_TARGET_PX = 1568;

export const STAGED_RESIZE_JPEG_QUALITY = 85;

export const STAGED_OBJECT_METADATA_KEY = 'staged-image';

/** imageIds are server-generated UUIDs (never a path: the object key is built from it). */
export const STAGED_IMAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
