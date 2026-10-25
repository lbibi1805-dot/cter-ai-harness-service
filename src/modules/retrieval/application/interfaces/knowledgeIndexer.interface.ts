import { type VaultEntry } from '../../../vault/domain';
import type { RetrievalConfig } from '../../domain/interfaces/retrieval.interface';

export type IndexingSettings = Pick<RetrievalConfig, 'embeddingProvider' | 'embeddingBatchSize' | 'embeddingDelayMs'>;

export interface IndexingPlan {
  /** Files whose content changed (or were never indexed) and can be chunked. */
  indexable: VaultEntry[];
  /** Files stored without content: they need a re-upload before they can be indexed. */
  emptyContent: string[];
}
