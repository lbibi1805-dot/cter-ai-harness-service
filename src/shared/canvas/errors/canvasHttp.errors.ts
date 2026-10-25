import { UpstreamError } from '../../errors';

/** A Canvas REST call answered with a non-2xx status. The message keeps the status so retries can classify it. */
export class CanvasRequestError extends UpstreamError {
  constructor(operation: string, response: Response, detail = '') {
    super(`Canvas ${operation} failed: ${response.status} ${response.statusText} ${detail}`.trim(), response.status);
  }
}
