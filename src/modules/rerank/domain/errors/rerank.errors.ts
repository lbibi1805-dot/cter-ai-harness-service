import { UpstreamError } from '../../../../shared/errors';

export class EmptyRerankResultError extends UpstreamError {
  constructor() {
    super('reranker returned no usable results');
  }
}
