import type { ModelRoute } from '../enums/ai.enums';

/** A model currently skipped by the circuit breaker. */
export interface ModelCircuitState {
  route: ModelRoute;
  model: string;
  /** ISO time until which the model is skipped. */
  until: string;
  /** The failure that opened the circuit. */
  reason: string;
}
