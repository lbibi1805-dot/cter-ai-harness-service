import { AI_PROVIDERS, type AiModule } from '../../modules/ai';
import { HEARTBEAT_PATH } from '../../modules/ops';
import { DEFAULT_POLL_CURSOR_FLUSH_MS } from '../../modules/polling';
import { logger } from '../../shared/logging/logger';
import { ObjectStorageKind } from '../../shared/storage';
import { envSuffix } from '../helpers/config.helper';
import type { AppConfig } from '../interfaces/appConfig.interface';

/** Logs which AI routes are usable per provider, and warns about providers no route can serve. */
export function logConfiguration(config: AppConfig, ai: AiModule): void {
  const routes = AI_PROVIDERS.map((provider) => {
    const direct = ai.adapters.direct(provider) !== null;
    const openRouter = ai.adapters.openRouter(provider) !== null;
    return `${provider}=${[direct && 'direct', openRouter && 'openrouter'].filter(Boolean).join('+') || 'none'}`;
  }).join(' ');
  logger.info(`Config loaded — AI routes: ${routes} | vault=${config.retrieval?.pineconeIndex ?? 'none'}`);
  for (const provider of AI_PROVIDERS) {
    if (!ai.configuredAdapters.isConfigured(provider)) logger.warn(`${ai.adapters.credentialName(provider)} not set — ${provider} requests will fail`);
  }
}

type PublicValue = string | number | boolean | string[] | null | undefined;
type PublicConfigEntry = readonly [name: string, read: (config: AppConfig) => PublicValue];

/**
 * Reads a config field that may not exist yet (added by a later plan), e.g.
 * `optionalField(config, 'chat', 'maxImages')`. Undefined when any step is missing.
 */
function optionalField(config: AppConfig, ...path: string[]): PublicValue {
  let value: unknown = config;
  for (const key of path) value = (value as Record<string, unknown> | undefined)?.[key];
  return value as PublicValue;
}

/**
 * WHITELIST for `GET /api/config`: env name to a reader of the running value.
 * Only flags, limits, model names and resource names belong here; never keys,
 * tokens, passwords or connection strings (presence is reported as a boolean).
 * To expose a new setting, add one line.
 */
const PUBLIC_CONFIG_ENTRIES: readonly PublicConfigEntry[] = [
  // AI models and limits
  ...AI_PROVIDERS.flatMap((provider): PublicConfigEntry[] => [
    [`DEFAULT_MODEL_${envSuffix(provider)}`, (c) => c.ai?.defaultModels?.[provider]],
    [`MODEL_FALLBACK_${envSuffix(provider)}`, (c) => c.ai?.modelFallback?.[provider]],
    [`OPENROUTER_MODEL_${envSuffix(provider)}`, (c) => c.ai?.openRouter?.models?.[provider]],
  ]),
  ['OPENROUTER_ENABLED', (c) => !!c.ai?.openRouter?.apiKey],
  ['OPENROUTER_MAX_TOKENS', (c) => c.ai?.openRouter?.maxTokens],
  ['AI_TIMEOUT_MS', (c) => c.ai?.timeoutMs],
  ['MAX_RETRY_COUNT', (c) => c.ai?.maxRetryCount],
  // Chat / context engineering
  ['CHAT_API_ENABLED', (c) => !!c.http?.chatApiToken],
  ['ADMIN_TOKEN_SET', (c) => !!c.http?.adminToken],
  ['MAX_CHAT_IMAGES', (c) => optionalField(c, 'chat', 'maxImages')],
  ['CHAT_MAX_BODY_BYTES', (c) => optionalField(c, 'chat', 'maxBodyBytes')],
  ['GEMINI_INLINE_IMAGES_MAX_BYTES', (c) => optionalField(c, 'chat', 'geminiInlineImagesMaxBytes')],
  ['CHAT_UPLOAD_TTL_MS', (c) => optionalField(c, 'chat', 'uploadTtlMs')],
  ['PROMPT_VERSION', (c) => optionalField(c, 'prompts', 'promptVersion')],
  ['ESSAY_MODE_ENABLED', (c) => optionalField(c, 'essay', 'enabled') ?? optionalField(c, 'context', 'essayModeEnabled')],
  ['CONVERSATION_STORE_ENABLED', (c) => c.context?.conversationStoreEnabled],
  ['CONVERSATION_PURGE_DAYS', (c) => c.context?.purgeDays],
  ['AUX_PROVIDER', (c) => c.context?.aux?.provider],
  ['AUX_MODEL', (c) => c.context?.aux?.model],
  ['CONTEXT_KEEP_RECENT_TURNS', (c) => c.context?.settings?.keepRecentTurns],
  ['CONTEXT_COMPACT_THRESHOLD_TOKENS', (c) => c.context?.settings?.compactThresholdTokens],
  ['CONTEXT_HOT_WINDOW_TURNS', (c) => c.context?.settings?.hotWindowTurns],
  ['CONTEXT_MAX_PROMPT_IMAGES', (c) => c.context?.settings?.maxPromptImages],
  // Retrieval
  ['RAG_ENABLED', (c) => !!c.retrieval],
  ['PINECONE_INDEX', (c) => c.retrieval?.pineconeIndex ?? null],
  ['EMBEDDING_PROVIDER', (c) => c.retrieval?.embeddingProvider ?? null],
  ['RAG_TOP_K', (c) => c.retrieval?.topK ?? null],
  ['RERANK_PROVIDER', (c) => c.rerank?.provider],
  ['RERANK_MODEL', (c) => c.rerank?.model],
  ['RERANK_CANDIDATES', (c) => c.rerank?.candidates],
  ['RERANK_TOP_N', (c) => c.rerank?.topN],
  ['AGENT_MAX_TOOL_CALLS', (c) => c.agent?.maxToolCalls],
  ['AGENT_MAX_DURATION_MS', (c) => c.agent?.maxDurationMs],
  ['AGENT_MAX_DIAGRAM_VALIDATIONS', (c) => c.agent?.maxDiagramValidations],
  ['DIAGRAM_SYNTAX_GUARD_ENABLED', (c) => c.diagramGuard?.enabled],
  ['DIAGRAM_SYNTAX_MAX_REPAIRS', (c) => c.diagramGuard?.maxRepairs],
  // Long, complete answers (12/11 plan 08)
  ['AI_MAX_OUTPUT_TOKENS', (c) => c.ai?.tuning?.maxOutputTokens],
  ['ANSWER_COMPLETENESS_ENABLED', (c) => c.answers?.enabled],
  ['ANSWER_MIN_WORDS_PER_QUESTION', (c) => c.answers?.minWordsPerQuestion],
  ['ANSWER_SECTION_MAX_QUESTIONS', (c) => c.answers?.sectionMaxQuestions],
  ['ANSWER_MAX_CONTINUATIONS', (c) => c.answers?.maxContinuations],
  ['ANSWER_COVERAGE_FIX', (c) => c.answers?.coverageFix],
  ['LONG_ANSWER_DEADLINE_MS', (c) => c.answers?.longAnswerDeadlineMs],
  ['ESSAY_MAX_ASPECTS', (c) => c.essay?.maxAspects],
  ['HISTORY_ASSISTANT_TURN_MAX_CHARS', (c) => c.historyAssistantTurnMaxChars],
  ['DIAGRAM_CONNECTIVITY_CHECK', (c) => c.c4?.connectivityCheck],
  ['C4_DESIGN_DISCUSSION_ENABLED', (c) => c.c4?.designDiscussionEnabled],
  // Storage
  ['VAULT_STORAGE_PROVIDER', (c) => c.database?.provider],
  ['DATABASE_CONFIGURED', (c) => !!c.database?.databaseUrl],
  ['OBJECT_STORAGE', (c) => (c.storage?.r2 ? ObjectStorageKind.R2 : ObjectStorageKind.LOCAL_DISK)],
  ['R2_BUCKET', (c) => c.storage?.r2?.bucket ?? null],
  // Photo capture (/api/captures, used by the cter-capture-client web app)
  ['CAPTURE_ENABLED', (c) => !!c.capture?.apiKey],
  ['CAPTURE_SEPARATE_UPLOAD_ACCESS', (c) => (c.capture ? !!c.capture.uploadKey : undefined)],
  ['CAPTURE_STORAGE', (c) => (c.capture ? (c.capture.storage.r2 ? ObjectStorageKind.R2 : ObjectStorageKind.LOCAL_DISK) : undefined)],
  ['CAPTURE_R2_BUCKET', (c) => (c.capture ? c.capture.storage.r2?.bucket ?? null : undefined)],
  ['CAPTURE_URL_TTL_SECONDS', (c) => c.capture?.urlTtlSeconds],
  ['CAPTURE_MAX_IMAGE_MB', (c) => (c.capture ? Math.round(c.capture.maxImageBytes / (1024 * 1024)) : undefined)],
  // Polling and heartbeat
  ['POLL_INTERVAL_MS', (c) => c.polling?.intervalMs],
  ['POLL_AUTOSTART', (c) => c.polling?.autostart],
  ['POLL_CURSOR_FLUSH_MS', (c) => c.polling?.cursorFlushMs ?? DEFAULT_POLL_CURSOR_FLUSH_MS],
  ['CANVAS_ACCOUNTS', (c) => c.accounts?.length],
  ['CRON_ENABLED', (c) => c.heartbeat?.enabled],
  ['CRON_INTERVAL_MS', (c) => c.heartbeat?.intervalMs],
  ['HEARTBEAT_PATH', () => HEARTBEAT_PATH],
];

/** Names that must never appear in `/api/config`, whatever the whitelist says. */
const SECRET_NAME_PATTERN = /(_KEY|TOKEN$|SECRET|PASSWORD|DATABASE_URL|_URL$)/;
/** `scheme://user:pass@host`: a URL carrying credentials. */
const CREDENTIAL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/\s]*@/i;

/** Non-secret flags and limits the service runs with (`GET /api/config`). Missing fields are omitted. */
export function publicConfigView(config: AppConfig): Record<string, PublicValue> {
  const view: Record<string, PublicValue> = {};
  for (const [name, read] of PUBLIC_CONFIG_ENTRIES) {
    if (SECRET_NAME_PATTERN.test(name)) continue;
    const value = read(config);
    if (value === undefined) continue;
    if (typeof value === 'string' && CREDENTIAL_URL_PATTERN.test(value)) continue;
    view[name] = value;
  }
  return view;
}
