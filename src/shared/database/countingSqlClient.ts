import { DbQueryCounter, dbQueryCounter } from './dbQueryCounter';
import { sqlTag, transactionTag } from './helpers/sqlTag.helper';
import type { SqlClient, SqlStatement } from './interfaces/sqlClient.interface';

/**
 * `SqlClient` decorator that records every round-trip (count, time, tag) in a
 * RAM counter. `label` overrides the tag derived from the SQL text, e.g. to
 * name the repository that owns the client.
 */
export function countingSqlClient(inner: SqlClient, counter: DbQueryCounter = dbQueryCounter, label?: string): SqlClient {
  const track = async <R>(tag: string, run: () => Promise<R>, transaction = false): Promise<R> => {
    counter.record(label ? `${label}: ${tag}` : tag, { transaction });
    try {
      return await run();
    } catch (err) {
      counter.recordFailure();
      throw err;
    }
  };
  return {
    query<T>(text: string, params?: unknown[]): Promise<T[]> {
      return track(sqlTag(text), () => inner.query<T>(text, params));
    },
    transaction(statements: SqlStatement[]): Promise<unknown[][]> {
      if (statements.length === 0) return inner.transaction(statements);
      return track(transactionTag(statements), () => inner.transaction(statements), true);
    },
  };
}
