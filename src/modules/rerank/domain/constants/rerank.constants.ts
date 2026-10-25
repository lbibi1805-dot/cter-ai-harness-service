import { RerankModel } from '../enums/rerank.enums';

/** Model parameters sent with every request; only models that accept them are listed. */
export const RERANK_MODEL_PARAMETERS: Partial<Record<string, Record<string, string>>> = {
  // Cut over-long query+document pairs instead of rejecting the request.
  [RerankModel.BGE_RERANKER_V2_M3]: { truncate: 'END' },
};

/** Joins file path parts and headings in the text the reranker sees. */
export const BREADCRUMB_SEPARATOR = ' › ';

/** Pinecone-hosted rerankers accept at most 100 documents per request. */
export const MAX_RERANK_DOCUMENTS = 100;
/** Long chunks are scored as up to this many overlapping windows (best window wins). */
export const MAX_PASSAGES_PER_CHUNK = 3;
/** Share of a window repeated in the next one, so a sentence cut at a border is still seen whole. */
export const PASSAGE_OVERLAP_RATIO = 0.2;
