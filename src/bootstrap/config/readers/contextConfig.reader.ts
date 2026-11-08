import { AIProvider } from '../../../modules/ai';
import { PromptCacheLayout } from '../../../modules/ai/domain/enums/promptLayout.enums';
import { ArtifactResolverMode, DEFAULT_CONTEXT_SETTINGS, DEFAULT_RESOLVER_SETTINGS } from '../../../modules/context';
import { ArtifactKind, DEFAULT_CONVERSATION_PURGE_DAYS } from '../../../modules/conversation-store';
import { readBoolean, readEnum, readInt, readList, readOptionalString, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';
import type { ContextAppConfig } from '../../interfaces/appConfig.interface';

export const DEFAULT_AUX_PROVIDER = AIProvider.GEMINI;
export const DEFAULT_AUX_MODEL = 'gemini-3.1-flash-lite';

function readNumber(name: string, fallback: number): number {
  const raw = readOptionalString(name);
  if (raw === undefined) return fallback;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) throw new ConfigurationError(`${name} must be a number, got "${raw}"`);
  return value;
}

function nonNegative(name: string, value: number): number {
  if (value < 0) throw new ConfigurationError(`${name} must be 0 or a positive integer, got ${value}`);
  return value;
}

function readKinds(name: string, fallback: readonly ArtifactKind[]): ArtifactKind[] {
  const allowed = Object.values(ArtifactKind) as string[];
  const kinds = readList(name, fallback);
  const unknown = kinds.filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw new ConfigurationError(`${name} has unknown artifact kinds: ${unknown.join(', ')} (allowed: ${allowed.join(', ')})`);
  return kinds as ArtifactKind[];
}

/** Conversation store (feature flag, default off) + context engineering + artifact resolver + aux model. */
export function readContextConfig(): ContextAppConfig {
  return {
    conversationStoreEnabled: readBoolean('CONVERSATION_STORE_ENABLED', false),
    purgeDays: readInt('CONVERSATION_PURGE_DAYS', DEFAULT_CONVERSATION_PURGE_DAYS),
    settings: {
      ...DEFAULT_CONTEXT_SETTINGS,
      keepRecentTurns: readInt('CONTEXT_KEEP_RECENT_TURNS', DEFAULT_CONTEXT_SETTINGS.keepRecentTurns),
      compactThresholdTokens: readInt('CONTEXT_COMPACT_THRESHOLD_TOKENS', DEFAULT_CONTEXT_SETTINGS.compactThresholdTokens),
      pinnedKinds: readKinds('CONTEXT_PINNED_KINDS', DEFAULT_CONTEXT_SETTINGS.pinnedKinds),
      promptLayout: readEnum('PROMPT_CACHE_LAYOUT', PromptCacheLayout, DEFAULT_CONTEXT_SETTINGS.promptLayout),
      hotWindowTurns: nonNegative('CONTEXT_HOT_WINDOW_TURNS', readInt('CONTEXT_HOT_WINDOW_TURNS', DEFAULT_CONTEXT_SETTINGS.hotWindowTurns)),
      maxPromptImages: nonNegative('CONTEXT_MAX_PROMPT_IMAGES', readInt('CONTEXT_MAX_PROMPT_IMAGES', DEFAULT_CONTEXT_SETTINGS.maxPromptImages)),
      resolver: {
        ...DEFAULT_RESOLVER_SETTINGS,
        mode: readEnum('ARTIFACT_RESOLVER_MODE', ArtifactResolverMode, DEFAULT_RESOLVER_SETTINGS.mode),
        minScore: readNumber('ARTIFACT_RESOLVER_MIN_SCORE', DEFAULT_RESOLVER_SETTINGS.minScore),
        margin: readNumber('ARTIFACT_RESOLVER_MARGIN', DEFAULT_RESOLVER_SETTINGS.margin),
        auxTimeoutMs: readInt('ARTIFACT_RESOLVER_AUX_TIMEOUT_MS', DEFAULT_RESOLVER_SETTINGS.auxTimeoutMs),
      },
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
      designNoteMs: 30_000,
    },
  };
}
