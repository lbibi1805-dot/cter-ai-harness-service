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
