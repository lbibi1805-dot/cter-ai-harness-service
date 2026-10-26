import { HttpMethod } from '../../../shared/http/enums/http.enums';
import type { ChatController } from './chat.controller';
import { exactPath } from '../../../shared/http/helpers/router.helper';
import { Route } from '../../../shared/http/interfaces/router.interface';
import { ChatApiPath } from './enums/chat.enums';

/** Both routes need `Authorization: Bearer <CHAT_API_TOKEN>`. */
export function createChatRoutes(controller: ChatController): Route[] {
  return [
    { method: HttpMethod.POST, match: exactPath(ChatApiPath.ASK), requiresAuth: true, handler: controller.ask },
    { method: HttpMethod.GET, match: exactPath(ChatApiPath.STATUS), requiresAuth: true, handler: controller.status },
  ];
}
