export const MARKDOWN_EXTENSION = '.md';

export const MAX_VAULT_PATH_LENGTH = 1023; // DB CHECK: length(file_path) < 1024

export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

/** Chunk ids are `<docId>#<hash8>#<idx3>`. */
export const CHUNK_ID_SEPARATOR = '#';

export const CHUNK_ID_HASH_CHARS = 8;

export const CHUNK_ID_INDEX_DIGITS = 3;
