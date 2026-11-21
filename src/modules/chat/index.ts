import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import { ChatService } from './application/chat.service';
import { ChatController } from './presentation/chat.controller';
import { createChatRoutes } from './presentation/chat.routes';
import { DEFAULT_CHAT_LIMITS } from './presentation/constants/chat.constants';
import { StagedImageService } from './application/stagedImages.service';
import { STAGED_IMAGES_MAX_ENTRIES } from './application/constants/stagedImages.constants';
import { CanvasImageResizer } from './infrastructure/canvasImageResizer.adapter';
import type { ChatModuleConfig, ChatModuleDeps, ChatModule } from './interfaces/chatModule.interface';

export type { ChatModuleConfig, ChatModuleDeps, ChatModule } from './interfaces/chatModule.interface';

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
