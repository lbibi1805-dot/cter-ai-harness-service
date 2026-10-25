import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { RetrievalQueryService } from '../application/retrievalQuery.service';
import { toRetrieveRequest } from './mappers/retrieval.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { MAX_RETRIEVE_BODY_BYTES } from './constants/retrieval.constants';

/** HTTP adapter for `POST /api/retrieve`. */
export class RetrievalController {
  constructor(private readonly retrieval: RetrievalQueryService) {}

  search = async ({ req, res }: RouteContext): Promise<void> => {
    this.retrieval.ensureEnabled();
    const request = toRetrieveRequest(await readJsonBody(req, MAX_RETRIEVE_BODY_BYTES));
    sendJson(res, HttpStatus.OK, { chunks: await this.retrieval.search(request) });
  };
}
