import { CircuitBreakerOptions, OpenCircuit } from './interfaces/circuitBreaker.interface';
import { DEFAULT_CIRCUIT_BREAKER } from './constants/circuitBreaker.constants';

/**
 * Per-key circuit breaker kept in memory: `failureThreshold` failures inside `windowMs` open the key for
 * `cooldownMs`; afterwards it closes by itself (the next call is a normal try). A success clears the failures.
 */
export class CircuitBreaker {
  private readonly failures = new Map<string, number[]>();
  private readonly open = new Map<string, OpenCircuit>();

  constructor(
    private readonly options: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER,
    private readonly now: () => number = Date.now,
  ) {}

  isOpen(key: string): boolean {
    const circuit = this.open.get(key);
    if (!circuit) return false;
    if (circuit.openUntil > this.now()) return true;
    this.open.delete(key);
    return false;
  }

  /** Returns true when this failure opened the circuit. */
  recordFailure(key: string, reason: string): boolean {
    const now = this.now();
    const recent = (this.failures.get(key) ?? []).filter((at) => now - at < this.options.windowMs);
    recent.push(now);
    if (recent.length < this.options.failureThreshold) {
      this.failures.set(key, recent);
      return false;
    }
    this.failures.delete(key);
    this.open.set(key, { key, openUntil: now + this.options.cooldownMs, reason });
    return true;
  }

  recordSuccess(key: string): void {
    this.failures.delete(key);
    this.open.delete(key);
  }

  /** Circuits open right now. */
  snapshot(): OpenCircuit[] {
    return [...this.open.keys()].filter((key) => this.isOpen(key)).map((key) => ({ ...this.open.get(key)! }));
  }
}
