import { SQL_TABLE_PATTERN, SQL_VERB_PATTERN, TRANSACTION_TAG_PREFIX, UNKNOWN_SQL_TAG } from '../constants/dbMetrics.constants';
import type { SqlStatement } from '../interfaces/sqlClient.interface';

/** Cheap caller hint from the SQL text: `SELECT poll_cursor`, `INSERT vault_manifest`. */
export function sqlTag(text: string): string {
  const verb = SQL_VERB_PATTERN.exec(text)?.[1]?.toUpperCase();
  if (!verb) return UNKNOWN_SQL_TAG;
  const table = SQL_TABLE_PATTERN.exec(text)?.[1]?.replace(/"/g, '');
  return table ? `${verb} ${table}` : verb;
}

export function transactionTag(statements: SqlStatement[]): string {
  const first = statements[0] ? sqlTag(statements[0].text) : UNKNOWN_SQL_TAG;
  const more = statements.length > 1 ? ` +${statements.length - 1}` : '';
  return `${TRANSACTION_TAG_PREFIX} ${first}${more}`;
}
