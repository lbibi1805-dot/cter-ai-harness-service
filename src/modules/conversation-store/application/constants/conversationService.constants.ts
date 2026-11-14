import { DEFAULT_PRESIGN_TTL_SECONDS } from '../../../../shared/storage';
import type { ConversationServiceOptions } from '../interfaces/conversationService.interface';

export const DEFAULT_CONVERSATION_PURGE_DAYS = 30;

/** GET /api/conversations `limit` (planning-12112026/07: clients ask 3 first, then 20 per "Xem thêm"). */
export const CONVERSATION_LIST_DEFAULT_LIMIT = 20;
export const CONVERSATION_LIST_MAX_LIMIT = 100;
/** Messages per page that new clients ask for (`?messages=40`) and the default `limit` of `/:id/messages`. */
export const CONVERSATION_DETAIL_DEFAULT_MESSAGES = 40;
/** Upper bound of `?messages=` / `limit`; also what GET /:id returns without `?messages=` (old clients). */
export const CONVERSATION_MESSAGES_MAX = 500;
/** Error codes of the paging/rename API (`{error: <code>}`, 400). */
export const INVALID_CURSOR_ERROR = 'invalid_cursor';
export const INVALID_TITLE_ERROR = 'invalid_title';

export const DEFAULT_CONVERSATION_SERVICE_OPTIONS: ConversationServiceOptions = {
  purgeDays: DEFAULT_CONVERSATION_PURGE_DAYS,
  purgeBatch: 50,
  maintenanceIntervalMs: 24 * 60 * 60 * 1000,
  presignTtlSeconds: DEFAULT_PRESIGN_TTL_SECONDS,
  maxMessages: CONVERSATION_MESSAGES_MAX,
  now: Date.now,
};

/**
 * Fields of a pending workflow shown by GET /api/conversations/:id (monitoring, note 16 §3): the step and
 * the questions waiting for the user — not the run's internals (knowledge chunks, architect JSON…).
 */
export const PENDING_STATE_PUBLIC_FIELDS: readonly string[] = ['id', 'step', 'intent', 'intentConfidence', 'systemName', 'summary', 'questions', 'expiresAt'];
