import { ValidationError } from '../../../../shared/errors';
import { RetrieveRequest } from '../../application/interfaces/retrievalQuery.interface';
import { MAX_RETRIEVE_TOP_K } from '../constants/retrieval.constants';

/** Shape validation of a `POST /api/retrieve` body. */
export function toRetrieveRequest(body: unknown): RetrieveRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;
  const query = typeof raw.query === 'string' ? raw.query.trim() : '';
  if (!query) throw new ValidationError('Missing query');
  const topK = raw.topK;
  if (topK !== undefined && (typeof topK !== 'number' || !Number.isInteger(topK) || topK < 1 || topK > MAX_RETRIEVE_TOP_K)) {
    throw new ValidationError(`topK must be an integer between 1 and ${MAX_RETRIEVE_TOP_K}`);
  }
  if (raw.rerank !== undefined && typeof raw.rerank !== 'boolean') throw new ValidationError('rerank must be a boolean');
  return { query, topK, rerank: raw.rerank };
}
