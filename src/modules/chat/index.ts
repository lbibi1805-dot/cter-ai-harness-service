import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { Answerer } from '../agent/domain';
import type { AIProvider, ModelCatalog } from '../ai';
import { ChatService } from './application/chat.service';
import { ChatController } from './presentation/chat.controller';
import { createChatRoutes } from './presentation/chat.routes';

export interface ChatModuleConfig {
  /** Bearer token for `/api/chat`; unset disables the API (fails closed). */
  chatApiToken?: string;
}

export interface ChatModuleDeps {
  answers: Answerer;
  catalog: ModelCatalog;
  agentEnabled: boolean;
  isProviderConfigured: (provider: AIProvider) => boolean;
}

export interface ChatModule {
  router: Router;
  enabled: boolean;
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
  });
  const controller = new ChatController(service);
  return { router: new Router(createChatRoutes(controller), config.chatApiToken), enabled };
}

export { ChatService } from './application/chat.service';
export type { ChatAnswer } from './application/interfaces/chat.interface';
export type { ChatQuestion } from './application/interfaces/chat.interface';
export type { ChatStatus } from './application/interfaces/chat.interface';
export { ChatApiPath } from './presentation/enums/chat.enums';
