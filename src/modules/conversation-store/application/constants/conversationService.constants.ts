import { DEFAULT_PRESIGN_TTL_SECONDS } from '../../../../shared/storage';
import type { ConversationServiceOptions } from '../interfaces/conversationService.interface';

export const DEFAULT_CONVERSATION_PURGE_DAYS = 30;

export const DEFAULT_CONVERSATION_SERVICE_OPTIONS: ConversationServiceOptions = {
  purgeDays: DEFAULT_CONVERSATION_PURGE_DAYS,
  purgeBatch: 50,
  maintenanceIntervalMs: 24 * 60 * 60 * 1000,
  presignTtlSeconds: DEFAULT_PRESIGN_TTL_SECONDS,
  maxMessages: 500,
  now: Date.now,
};

/**
 * Fields of a pending workflow shown by GET /api/conversations/:id (monitoring, note 16 §3): the step and
 * the questions waiting for the user — not the run's internals (knowledge chunks, architect JSON…).
 */
export const PENDING_STATE_PUBLIC_FIELDS: readonly string[] = ['id', 'step', 'intent', 'intentConfidence', 'systemName', 'summary', 'questions', 'expiresAt'];
