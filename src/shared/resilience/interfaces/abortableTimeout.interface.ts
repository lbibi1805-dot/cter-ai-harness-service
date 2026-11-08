export interface GuardedCallOptions {
  /** Hard cap for the whole call (stream included). */
  totalMs: number;
  /** Time allowed before the first `touch()` (first streamed token); omitted = no separate limit. */
  firstTokenMs?: number;
  /** Longest silence allowed between two `touch()` calls once the first one happened; omitted = no limit. */
  idleMs?: number;
  /** Shown in the TimeoutError message, e.g. `gemini/gemini-3.5-flash`. */
  label: string;
  /** Aborting it (request deadline, client gone) aborts this call too. */
  parent?: AbortSignal;
}

/** Handed to the guarded operation: pass `signal` to the SDK and call `touch()` on every streamed chunk. */
export interface GuardedCallControls {
  signal: AbortSignal;
  touch(): void;
}
