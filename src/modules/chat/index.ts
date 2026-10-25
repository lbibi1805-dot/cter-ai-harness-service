import { Router } from '../../shared/http/router';
import type { AppConfig } from '../../types';
import { logger } from '../../utils/logger';
import type { Answerer } from '../agent/domain';
import { ChatController } from './presentation/chat.controller';
import { createChatRoutes } from './presentation/chat.routes';

export interface ChatModuleDeps {
  answers: Answerer;
  agentEnabled: boolean;
}

export interface ChatModule {
  router: Router;
  enabled: boolean;
}

/**
 * The chat API spends AI credits, so unlike ADMIN_TOKEN it fails closed: with
 * no CHAT_API_TOKEN the routes exist but answer 503.
 */
export function createChatModule(config: AppConfig, deps: ChatModuleDeps): ChatModule {
  const enabled = !!config.chatApiToken;
  if (!enabled) logger.info('[chat-api] CHAT_API_TOKEN not set — /api/chat disabled');
  const controller = new ChatController(deps.answers, {
    enabled,
    agentEnabled: deps.agentEnabled,
    aiKeys: config.aiKeys,
    defaultModels: config.defaultModels,
  });
  return { router: new Router(createChatRoutes(controller), config.chatApiToken), enabled };
}

export { ChatApiPath } from './presentation/chat.routes';
