import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import { withTimeout } from '../../../shared/resilience/withTimeout';
import type { CitedChunk } from '../../retrieval/domain/interfaces/retrieval.interface';
import {
  EmptyRerankResultError,
  truncate,
  type ChunkRetriever,
  type Reranker,
} from '../domain';
import { RerankingOptions } from './interfaces/rerankingRetriever.interface';
import { buildRerankRequest, applyHits } from './helpers/rerankingRetriever.helper';

/**
 * Decorator over vector retrieval: fetches the inner retriever's (wide)
 * candidate list, reorders it with a cross-encoder and keeps the best `topN`.
 * Reranking is an optimisation, never a dependency: any failure returns the
 * cosine order cut to the legacy top-k, so answers keep flowing.
 */
export class RerankingRetriever implements ChunkRetriever {
  constructor(
    private readonly inner: ChunkRetriever,
    private readonly reranker: Reranker,
    private readonly options: RerankingOptions,
    private readonly now: () => number = Date.now,
  ) {}

  async retrieve(question: string): Promise<CitedChunk[]> {
    const candidates = await this.inner.retrieve(question);
    if (candidates.length <= 1) return candidates;

    const started = this.now();
    const reranked = await attempt(() => this.rank(question, candidates));
    if (!reranked.ok) {
      logger.info(`[rerank] ${this.options.label} — failed after ${this.now() - started}ms (${errorMessage(reranked.error)}) — using vector order`);
      return candidates.slice(0, this.options.fallbackTopK);
    }
    const ranked = reranked.value;
    logger.info(`[rerank] ${this.options.label} — ${candidates.length}→${ranked.length} in ${this.now() - started}ms (top1 ${ranked[0].rerankScore?.toFixed(3)} ${ranked[0].source})`);
    return ranked;
  }

  /** Every passage is scored; a chunk's score is its best passage. */
  private async rank(question: string, candidates: CitedChunk[]): Promise<CitedChunk[]> {
    const { documents, owners } = buildRerankRequest(candidates, this.options.maxDocumentChars);
    const query = truncate(question.trim(), this.options.maxQueryChars);
    const hits = await withTimeout(
      this.reranker.rerank(query, documents, documents.length),
      this.options.timeoutMs,
      `rerank ${this.reranker.model}`,
    );
    const ranked = applyHits(candidates, hits, owners).slice(0, Math.min(this.options.topN, candidates.length));
    if (ranked.length === 0) throw new EmptyRerankResultError();
    return ranked;
  }
}
