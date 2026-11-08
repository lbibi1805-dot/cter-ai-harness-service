import { HttpMethod } from '../../../shared/http/enums/http.enums';
import { exactPath } from '../../../shared/http/helpers/router.helper';
import type { Route } from '../../../shared/http/interfaces/router.interface';
import type { C4Controller } from './c4.controller';
import type { C4RenderController } from './c4Render.controller';
import { C4ApiPath } from './enums/c4.enums';

/** Needs `Authorization: Bearer <CHAT_API_TOKEN>`, like /api/chat (it spends AI credits). */
export function createC4Routes(controller: C4Controller, render?: C4RenderController): Route[] {
  return [
    { method: HttpMethod.POST, match: exactPath(C4ApiPath.SKETCH), requiresAuth: true, handler: controller.sketch },
    { method: HttpMethod.POST, match: exactPath(C4ApiPath.RESUME), requiresAuth: true, handler: controller.resume },
    ...(render ? [{ method: HttpMethod.POST, match: exactPath(C4ApiPath.RENDER), requiresAuth: true, handler: render.render }] : []),
  ];
}
