import { AIProvider } from '../../../modules/ai';
import { DEFAULT_CONTEXT_SETTINGS } from '../../../modules/context';
import { DEFAULT_CONVERSATION_PURGE_DAYS } from '../../../modules/conversation-store';
import { readBoolean, readEnum, readInt, readString } from '../../../shared/config/env';
import type { ContextAppConfig } from '../../interfaces/appConfig.interface';

export const DEFAULT_AUX_PROVIDER = AIProvider.GEMINI;
export const DEFAULT_AUX_MODEL = 'gemini-3.1-flash-lite';

/** Conversation store (feature flag, default off) + context engineering + aux model. */
export function readContextConfig(): ContextAppConfig {
  return {
    conversationStoreEnabled: readBoolean('CONVERSATION_STORE_ENABLED', false),
    purgeDays: readInt('CONVERSATION_PURGE_DAYS', DEFAULT_CONVERSATION_PURGE_DAYS),
    settings: {
      ...DEFAULT_CONTEXT_SETTINGS,
      keepRecentTurns: readInt('CONTEXT_KEEP_RECENT_TURNS', DEFAULT_CONTEXT_SETTINGS.keepRecentTurns),
      compactThresholdTokens: readInt('CONTEXT_COMPACT_THRESHOLD_TOKENS', DEFAULT_CONTEXT_SETTINGS.compactThresholdTokens),
    },
    aux: {
      provider: readEnum('AUX_PROVIDER', AIProvider, DEFAULT_AUX_PROVIDER),
      model: readString('AUX_MODEL', DEFAULT_AUX_MODEL),
    },
    timeouts: {
      imageNoteMs: 30_000,
      imageNoteSyncMs: readInt('AUX_SYNC_TIMEOUT_MS', 15_000),
      rewriteMs: 8_000,
      compactMs: 60_000,
    },
  };
}
