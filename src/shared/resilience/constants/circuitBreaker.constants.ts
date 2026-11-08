import { CircuitBreakerOptions } from '../interfaces/circuitBreaker.interface';

/** 3 qualifying failures within 60 s open the circuit for 2 minutes. */
export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerOptions = { failureThreshold: 3, windowMs: 60_000, cooldownMs: 120_000 };
