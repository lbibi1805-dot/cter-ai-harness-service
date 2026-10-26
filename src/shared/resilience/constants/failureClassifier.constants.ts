import { HttpStatus } from '../../http/enums/http.enums';

export const RATE_LIMIT_PATTERN = /rate.?limit|too many requests|quota|resource.?exhausted/i;

export const FATAL_PATTERN = /not configured|invalid api key|api key not valid|incorrect api key|unauthorized|authentication|insufficient credits/i;

export const STATUS_IN_MESSAGE = /\b([45]\d{2})\b/;

export const CLIENT_ERROR_MIN = 400;

export const SERVER_ERROR_MIN = 500;

/** Statuses that mean "nothing will work until an operator fixes credentials or billing". */
export const FATAL_STATUSES: ReadonlySet<number> = new Set([HttpStatus.UNAUTHORIZED, HttpStatus.PAYMENT_REQUIRED]);

export const TRANSIENT_CLIENT_STATUSES: ReadonlySet<number> = new Set([HttpStatus.REQUEST_TIMEOUT, HttpStatus.TOO_EARLY]);
