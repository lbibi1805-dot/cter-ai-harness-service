import { ServiceDisabledError } from '../../../shared/errors';
import type { CitedChunk } from '../domain/interfaces/retrieval.interface';
import { RetrievalQueryDeps, RetrieveRequest } from './interfaces/retrievalQuery.interface';
import { RETRIEVE_API_LABEL } from './constants/retrievalQuery.constants';

/**
 * Retrieval without generation, for evaluating the RAG stage on its own. By
 * default it is exactly the production single-shot retrieval; `topK`/`rerank`
 * build a one-off variant to compare settings.
 */
export class RetrievalQueryService {
  constructor(private readonly deps: RetrievalQueryDeps) {}

  ensureEnabled(): void {
    if (!this.deps.enabled) throw new ServiceDisabledError('Retrieval API disabled: set CHAT_API_TOKEN on the server');
  }

  async search({ query, topK, rerank }: RetrieveRequest): Promise<CitedChunk[]> {
    this.ensureEnabled();
    const { vectorSearch, reranker } = this.deps;
    if (!vectorSearch) throw new ServiceDisabledError('Vector index not ready (vault still indexing or PINECONE_API_KEY unset)');

    const production = this.deps.productionRetriever();
    if (production && topK === undefined && rerank === undefined) return production.retrieve(query);

    const wanted = topK ?? vectorSearch.defaultTopK;
    const useRerank = (rerank ?? true) && reranker.enabled;
    if (!useRerank) return vectorSearch.createRetriever(wanted).retrieve(query);
    const candidates = vectorSearch.createRetriever(reranker.candidateCount(wanted));
    return reranker.wrap(candidates, { topN: wanted, fallbackTopK: wanted, label: RETRIEVE_API_LABEL }).retrieve(query);
  }
}
