export interface CircuitBreakerOptions {
  /** Failures within `windowMs` that open the circuit. */
  failureThreshold: number;
  windowMs: number;
  /** How long an open circuit makes callers skip the key. */
  cooldownMs: number;
}

/** One open circuit. */
export interface OpenCircuit {
  key: string;
  /** Epoch ms until which the key is skipped. */
  openUntil: number;
  /** The failure that opened it. */
  reason: string;
}
