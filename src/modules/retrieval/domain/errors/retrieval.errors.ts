import { ConfigurationError, UpstreamError } from '../../../../shared/errors';
import type { EmbeddingProvider } from '../enums/retrieval.enums';
import { MS_PER_SECOND } from '../constants/retrieval.constants';

export class EmbeddingKeyMissingError extends ConfigurationError {
  constructor(provider: EmbeddingProvider, envVar: string) {
    super(`${envVar} required for ${provider} embedding`);
  }
}

export class VectorIndexNotReadyError extends UpstreamError {
  constructor(indexName: string, waitedMs: number) {
    super(`Index ${indexName} not ready after ${Math.round(waitedMs / MS_PER_SECOND)}s`);
  }
}
