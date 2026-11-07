/** One parameterized statement of a batch. */
export interface SqlStatement {
  text: string;
  params?: unknown[];
}

/**
 * The SQL port every repository talks to. Each call is ONE round-trip to the
 * database (Neon bills compute by awake time, so callers batch work into
 * `transaction` instead of issuing many small queries).
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs the statements in order inside one transaction, one round-trip; returns each statement's rows. */
  transaction(statements: SqlStatement[]): Promise<unknown[][]>;
}
