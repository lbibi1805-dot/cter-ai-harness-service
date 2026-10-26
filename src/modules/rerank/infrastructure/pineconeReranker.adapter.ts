import { Pinecone } from '@pinecone-database/pinecone';
import { SDK_MAX_RETRIES } from '../../../shared/resilience/constants/sdk.constants';
import { RERANK_MODEL_PARAMETERS, type Reranker, type RerankHit } from '../domain';
import { PineconeRerankerOptions } from './interfaces/pineconeReranker.interface';

/** Pinecone Inference rerank (`POST /rerank`); reuses the vector index's API key. */
export class PineconeReranker implements Reranker {
  readonly model: string;
  private readonly client: Pinecone;

  constructor(options: PineconeRerankerOptions) {
    this.model = options.model;
    this.client = new Pinecone({
      apiKey: options.apiKey,
      // The SDK retries 5xx up to 3 times with backoff by default. Reranking is
      // optional — on failure the caller falls back to the vector order at once —
      // so hidden retries would only add load and latency.
      maxRetries: SDK_MAX_RETRIES,
      ...(options.controllerHostUrl ? { controllerHostUrl: options.controllerHostUrl } : {}),
    });
  }

  async rerank(query: string, documents: string[], topN: number): Promise<RerankHit[]> {
    const result = await this.client.inference.rerank({
      model: this.model,
      query,
      documents,
      topN,
      returnDocuments: false,
      parameters: RERANK_MODEL_PARAMETERS[this.model],
    });
    return result.data.map(({ index, score }) => ({ index, score }));
  }
}
