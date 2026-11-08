import { CircuitBreaker } from '../../../shared/resilience/circuitBreaker';
import type { CircuitBreakerOptions } from '../../../shared/resilience/interfaces/circuitBreaker.interface';
import type { ModelRoute } from '../domain/enums/ai.enums';
import type { ModelCircuitState } from '../domain/interfaces/modelCircuit.interface';
import { CIRCUIT_KEY_SEPARATOR } from './constants/aiInvocation.constants';

/** The circuit breaker keyed by route + model (the same model id may be served directly and via OpenRouter). */
export class ModelCircuitBreaker {
  private readonly breaker: CircuitBreaker;

  constructor(options: CircuitBreakerOptions, now: () => number = Date.now) {
    this.breaker = new CircuitBreaker(options, now);
  }

  isOpen(route: ModelRoute, model: string): boolean {
    return this.breaker.isOpen(key(route, model));
  }

  /** Returns true when this failure opened the circuit. */
  recordFailure(route: ModelRoute, model: string, reason: string): boolean {
    return this.breaker.recordFailure(key(route, model), reason);
  }

  recordSuccess(route: ModelRoute, model: string): void {
    this.breaker.recordSuccess(key(route, model));
  }

  /** Models skipped right now (for `/api/ai-usage`). */
  snapshot(): ModelCircuitState[] {
    return this.breaker.snapshot().map((open) => {
      const separator = open.key.indexOf(CIRCUIT_KEY_SEPARATOR);
      return {
        route: open.key.slice(0, separator) as ModelRoute,
        model: open.key.slice(separator + CIRCUIT_KEY_SEPARATOR.length),
        until: new Date(open.openUntil).toISOString(),
        reason: open.reason,
      };
    });
  }
}

function key(route: ModelRoute, model: string): string {
  return `${route}${CIRCUIT_KEY_SEPARATOR}${model}`;
}
