import type { PromptTrace } from './presentation/interfaces/promptTrace.interface';
import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { Answerer } from '../agent/domain';
import type { AIProvider, ModelCatalog } from '../ai';
import { ChatService } from './application/chat.service';
import type { ChatTurns } from './application/interfaces/chatTurns.interface';
import type { EssayAuxInput, EssayAuxSession, EssayWriter } from './application/interfaces/chat.interface';
import { ChatController } from './presentation/chat.controller';
import { createChatRoutes } from './presentation/chat.routes';
import { DEFAULT_CHAT_LIMITS } from './presentation/constants/chat.constants';
import type { ChatLimits } from './presentation/interfaces/chatLimits.interface';
import type { ObjectStorage } from '../../shared/storage';
import { StagedImageService } from './application/stagedImages.service';
import { STAGED_IMAGES_MAX_ENTRIES } from './application/constants/stagedImages.constants';
import type { ImageResizer } from './application/interfaces/stagedImages.interface';
import { CanvasImageResizer } from './infrastructure/canvasImageResizer.adapter';

export interface ChatModuleConfig {
  /** Bearer token for `/api/chat`; unset disables the API (fails closed). */
  chatApiToken?: string;
  /** Body size / image limits; absent = defaults (20 MB body, 10 images, 15 MB inline images for Gemini). */
  limits?: ChatLimits;
}

export interface ChatModuleDeps {
  answers: Answerer;
  catalog: ModelCatalog;
  agentEnabled: boolean;
  isProviderConfigured: (provider: AIProvider) => boolean;
  /** Server-side conversation memory (context module); absent = stateless. */
  turns?: ChatTurns;
  /** Essay Mode (EssayService); absent without retrieval. */
  essay?: EssayWriter;
  /** Essay Mode: per-request router session (routing + essay analysis in one aux call); absent = essay analyses alone. */
  essayAux?: (input: EssayAuxInput) => EssayAuxSession | null;
  /** Object storage for upload-first images (`tmp/uploads/`); absent = `/api/chat/images` answers 503. */
  storage?: ObjectStorage;
  /** Test hook: image downscaler (default `@napi-rs/canvas`). */
  resizer?: ImageResizer | null;
  now?: () => number;
  /** `trace.prompt` (12/11 02 Bước 6): prompt composition of a path; absent = no prompt trace. */
  promptTrace?: PromptTrace;
}

export interface ChatModule {
  router: Router;
  enabled: boolean;
  /** Upload-first images, shared with /api/c4 (`imageIds`); null without object storage. */
  uploads: StagedImageService | null;
}

/**
 * The chat API spends AI credits, so unlike ADMIN_TOKEN it fails closed: with
 * no CHAT_API_TOKEN the routes exist but answer 503.
 */
export function createChatModule(config: ChatModuleConfig, deps: ChatModuleDeps): ChatModule {
  const enabled = !!config.chatApiToken;
  if (!enabled) logger.info('[chat-api] CHAT_API_TOKEN not set — /api/chat disabled');
  const service = new ChatService(deps.answers, deps.catalog, {
    enabled,
    agentEnabled: deps.agentEnabled,
    isProviderConfigured: deps.isProviderConfigured,
    turns: deps.turns,
    ...(deps.essay ? { essay: deps.essay } : {}),
    ...(deps.essay && deps.essayAux ? { essayAux: deps.essayAux } : {}),
  });
  const limits = config.limits ?? DEFAULT_CHAT_LIMITS;
  const uploads = deps.storage
    ? new StagedImageService(deps.storage, deps.resizer === undefined ? new CanvasImageResizer() : deps.resizer, {
        ttlMs: limits.uploadTtlMs, maxEntries: STAGED_IMAGES_MAX_ENTRIES, now: deps.now ?? Date.now,
      })
    : null;
  const controller = new ChatController(service, limits, uploads, deps.promptTrace);
  return { router: new Router(createChatRoutes(controller), config.chatApiToken), enabled, uploads };
}

export { ChatService } from './application/chat.service';
export type { ChatAnswer } from './application/interfaces/chat.interface';
export type { ChatQuestion, ChatSource } from './application/interfaces/chat.interface';
export type { ChatLimits } from './presentation/interfaces/chatLimits.interface';
export { DEFAULT_CHAT_LIMITS, DEFAULT_CHAT_MAX_BODY_MB, DEFAULT_MAX_CHAT_IMAGES, DEFAULT_GEMINI_INLINE_IMAGES_MAX_MB, BYTES_PER_MB } from './presentation/constants/chat.constants';
export type { ChatStatus, EssayAuxInput, EssayAuxSession } from './application/interfaces/chat.interface';
export { ChatApiPath } from './presentation/enums/chat.enums';
export { StagedImageService } from './application/stagedImages.service';
export { parseImageIds } from './application/helpers/imageIds.helper';
export { sniffImage } from './application/helpers/imageSniff.helper';
export { CanvasImageResizer } from './infrastructure/canvasImageResizer.adapter';
export { DEFAULT_CHAT_UPLOAD_TTL_MS, STAGED_IMAGE_PREFIX } from './application/constants/stagedImages.constants';
export type { ImageResizer, StagedImageDto } from './application/interfaces/stagedImages.interface';
export { CHAT_OPENAPI_PATHS } from './presentation/constants/chatOpenApi.constants';
export type { ChatTurns, ChatTurnInput, ChatTurnOutcome, ChatTurnRecord, PreparedChatTurn } from './application/interfaces/chatTurns.interface';
export type { PromptTrace, PromptTraceEntry } from './presentation/interfaces/promptTrace.interface';
export { AnswerOrchestrator } from './application/answerOrchestrator.service';
export { AnswerMetrics } from './application/answerMetrics.service';
export { DEFAULT_ANSWER_PROMPTS } from './application/constants/answerPrompts.constants';
export { ANSWER_PROMPT_IDS, DEFAULT_ANSWER_COMPLETENESS } from './domain/constants/answerPlan.constants';
export { buildAnswerPlan, checkCoverage, groupSections } from './domain/helpers/answerPlan.helper';
export type { AnswerCompletenessSettings, AnswerMetricsSummary, AnswerPlan, AnswerPrompts, PlannedQuestion } from './domain/interfaces/answerPlan.interface';
export { answerPromptsFrom } from './application/helpers/answerPrompts.helper';
export { incompleteSentences, scoreAnswerCase } from './domain/helpers/answerEval.helper';
export type { AnswerGoldenCase, AnswerGoldenScore } from './domain/interfaces/answerEval.interface';
