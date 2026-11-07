import type { RetrievalConfig } from '../../domain/interfaces/retrieval.interface';

export type IndexingSettings = Pick<RetrievalConfig, 'embeddingProvider' | 'embeddingBatchSize' | 'embeddingDelayMs'>;
