import { RerankModel, RerankProvider } from '../enums/rerank.enums';
import { RerankConfig } from '../interfaces/rerankConfig.interface';

export const DEFAULT_RERANK_CONFIG: RerankConfig = {
  provider: RerankProvider.NONE,
  model: RerankModel.BGE_RERANKER_V2_M3,
  candidates: 40,
  topN: 8,
  timeoutMs: 5_000,
  maxQueryChars: 600,
  maxDocumentChars: 1_500,
};
