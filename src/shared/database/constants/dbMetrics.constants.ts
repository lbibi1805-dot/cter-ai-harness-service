/** Tag used when a statement's verb or table cannot be read from its text. */
export const UNKNOWN_SQL_TAG = 'unknown';

/** Tag prefix for a `transaction` batch (`TX <first statement tag> +N`). */
export const TRANSACTION_TAG_PREFIX = 'TX';

/** Distinct tags kept in `byTag`; later tags are folded into `UNKNOWN_SQL_TAG` so the map stays bounded. */
export const MAX_TRACKED_SQL_TAGS = 100;

/** `SELECT … FROM t`, `INSERT INTO t`, `UPDATE t`, `DELETE FROM t`, `CREATE TABLE [IF NOT EXISTS] t`, `CREATE INDEX … ON t`. */
export const SQL_TABLE_PATTERN = /\b(?:FROM|INTO|UPDATE|TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ON)\s+("?[\w.]+"?)/i;

export const SQL_VERB_PATTERN = /^\s*([A-Za-z]+)/;
