// Marker protocol — backend mirror of `extension/lib/messageFormat.js`. Keep both in sync.
export const REQUEST_MARKER = '[CFH:REQUEST]';
export const REPLY_MARKER = '[CFH:REPLY]';
export const SETTINGS_CONVERSATION_MARKER = '[CFH:SETTINGS]';
export const ACTIVE_CONVERSATION_SUBJECT_PREFIX = '[ACTIVE]';
export const SETTING_MESSAGE_PREFIX_START = '[CFH:SETTING:';

/** Max REQUEST messages answered per account per poll round (bounds latency). */
export const MAX_CONV_PER_ROUND = 5;

/**
 * The settings conversation is rediscovered at most this often. Discovery pages
 * through every sent conversation (8+ requests per account), so doing it on
 * every tick made each tick slower than the poll interval.
 */
export const SETTINGS_CACHE_TTL_MS = 10 * 60 * 1000;

/** Canvas page size when scanning sent conversations for the settings marker. */
export const SETTINGS_DISCOVERY_PAGE_SIZE = 10;
/** A posted reply is verified by matching this many leading characters of its body. */
export const REPLY_VERIFY_PREFIX_CHARS = 64;

/** Provider shown in an invalid-format reply when the request named none. */
export const UNKNOWN_PROVIDER = 'unknown';
export const DEFAULT_ATTACHMENT_NAME = 'attachment';
export const DEFAULT_IMAGE_MIME = 'image/png';
export const IMAGE_MIME_PREFIX = 'image/';
