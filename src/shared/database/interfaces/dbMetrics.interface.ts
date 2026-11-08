/** RAM-only view of the SQL traffic since boot (`GET /api/metrics/db`). Reading it never touches the database. */
export interface DbQueryStats {
  bootAt: string;
  /** Round-trips since boot (a `transaction` batch counts as one, the way Neon bills it). */
  queriesSinceBoot: number;
  transactionsSinceBoot: number;
  failedQueries: number;
  lastQueryAt: string | null;
  /** Who/what ran the last query: an explicit label, else `KEYWORD table` derived from the SQL. */
  lastQueryTag: string | null;
  /** Round-trips per tag since boot. */
  byTag: Record<string, number>;
}
