/** HYBRID_SEARCH_ENABLED default: BM25 in RAM fused with the vector results (15 §3.2). */
export const DEFAULT_HYBRID_SEARCH_ENABLED = true;

/** Reciprocal-rank-fusion constant (Cormack et al.). */
export const HYBRID_RRF_K = 60;

/** BM25 field weights: the accented text matches exact Vietnamese terms better than the stripped copy. */
export const LEXICAL_FIELD_BOOST = { text: 2, plain: 1 } as const;

/** Field names of the MiniSearch documents. */
export const LEXICAL_FIELDS = ['text', 'plain'] as const;

/** Terms shorter than this are ignored (Vietnamese/English particles). */
export const LEXICAL_MIN_TERM_LENGTH = 2;

/** Prefix matching for terms at least this long ("kiểm thử" ↔ "kiểm thử viên"); short terms match exactly. */
export const LEXICAL_PREFIX_MIN_LENGTH = 4;

/** Combining diacritical marks left after NFD decomposition. */
export const COMBINING_MARKS = /[̀-ͯ]/g;

export const VIETNAMESE_D = /đ/g;

export const VIETNAMESE_D_UPPER = /Đ/g;

export const PLAIN_D = 'd';

export const PLAIN_D_UPPER = 'D';

export const UNICODE_NFD = 'NFD';

export const UNICODE_NFC = 'NFC';

/** After a sync that could not read some documents, wait this long before a search triggers another one. */
export const LEXICAL_SYNC_RETRY_MS = 60_000;

/** Between `docId:hash` pairs of the corpus signature. */
export const LEXICAL_SIGNATURE_SEPARATOR = '|';
