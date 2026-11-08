import { ObjectPrefix } from '../../../../shared/storage';

/** `tmp/c4-pending/<sessionId>/<n>.<ext>`: the bucket's 1-day lifecycle rule removes what a resume never took. */
export const C4_PENDING_IMAGE_PREFIX = `${ObjectPrefix.TMP}c4-pending/`;

export const DEFAULT_IMAGE_MIME = 'application/octet-stream';
