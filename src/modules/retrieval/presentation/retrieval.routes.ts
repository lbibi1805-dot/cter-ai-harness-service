import { HttpMethod } from '../../../shared/http/enums/http.enums';
import type { RetrievalController } from './retrieval.controller';
import { exactPath } from '../../../shared/http/helpers/router.helper';
import { Route } from '../../../shared/http/interfaces/router.interface';
import { RetrievalApiPath } from './enums/retrieval.enums';

/** Needs `Authorization: Bearer <CHAT_API_TOKEN>`. */
export function createRetrievalRoutes(controller: RetrievalController): Route[] {
  return [{ method: HttpMethod.POST, match: exactPath(RetrievalApiPath.RETRIEVE), requiresAuth: true, handler: controller.search }];
}
