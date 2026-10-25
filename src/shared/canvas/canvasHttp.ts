import { HttpHeader } from '../http/enums/http.enums';
import { CanvasRequestError } from './errors/canvasHttp.errors';
import { LINK_URL } from './constants/canvasHttp.constants';

export function bearerHeaders(apiKey: string): Record<string, string> {
  return { [HttpHeader.AUTHORIZATION]: `Bearer ${apiKey}` };
}

/** Throws CanvasRequestError unless the response is 2xx. */
export function ensureOk(response: Response, operation: string): Response {
  if (!response.ok) throw new CanvasRequestError(operation, response);
  return response;
}

/** URL of the page with the given relation from a `Link` header (Canvas pagination), or null. */
export function linkUrl(linkHeader: string | null, rel = 'next'): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const [urlPart, ...params] = part.split(';');
    if (!params.some((param) => param.trim() === `rel="${rel}"`)) continue;
    const match = urlPart.trim().match(LINK_URL);
    if (match) return match[1];
  }
  return null;
}
