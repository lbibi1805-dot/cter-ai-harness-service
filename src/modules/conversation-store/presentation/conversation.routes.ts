import { HttpMethod } from '../../../shared/http/enums/http.enums';
import { exactPath, wildcardPath } from '../../../shared/http/helpers/router.helper';
import type { Route } from '../../../shared/http/interfaces/router.interface';
import type { ConversationController } from './conversation.controller';
import { ConversationApiPath } from './enums/conversation.enums';

/** Routes need `Authorization: Bearer <CHAT_API_TOKEN>` (same token as /api/chat) or `Bearer <ADMIN_TOKEN>` (monitoring UI). */
export function createConversationRoutes(controller: ConversationController): Route[] {
  return [
    { method: HttpMethod.GET, match: exactPath(ConversationApiPath.LIST), requiresAuth: true, handler: controller.list },
    { method: HttpMethod.POST, match: wildcardPath(ConversationApiPath.PREFIX, ConversationApiPath.RESTORE_SUFFIX), requiresAuth: true, handler: controller.restore },
    // Before the generic GET: `/:id/messages` is a page of older messages, not a conversation id.
    { method: HttpMethod.GET, match: wildcardPath(ConversationApiPath.PREFIX, ConversationApiPath.MESSAGES_SUFFIX), requiresAuth: true, handler: controller.messages },
    { method: HttpMethod.GET, match: wildcardPath(ConversationApiPath.PREFIX), requiresAuth: true, handler: controller.get },
    { method: HttpMethod.PATCH, match: wildcardPath(ConversationApiPath.PREFIX), requiresAuth: true, handler: controller.rename },
    // Checks its own token: CHAT_API_TOKEN or ADMIN_TOKEN for a soft delete, ADMIN_TOKEN for `?hard=true`.
    { method: HttpMethod.DELETE, match: wildcardPath(ConversationApiPath.PREFIX), handler: controller.delete },
  ];
}
