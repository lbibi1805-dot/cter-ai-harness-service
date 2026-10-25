import { HttpMethod } from '../../../shared/http/http.enums';
import { exactPath, type Route } from '../../../shared/http/router';
import type { ChatController } from './chat.controller';

export enum ChatApiPath {
  ASK = '/api/chat',
  STATUS = '/api/chat/status',
}

/** Both routes need `Authorization: Bearer <CHAT_API_TOKEN>`. */
export function createChatRoutes(controller: ChatController): Route[] {
  return [
    { method: HttpMethod.POST, match: exactPath(ChatApiPath.ASK), requiresAuth: true, handler: controller.ask },
    { method: HttpMethod.GET, match: exactPath(ChatApiPath.STATUS), requiresAuth: true, handler: controller.status },
  ];
}
