import type { FailureKind } from '../../../../shared/resilience/enums/resilience.enums';

export interface FailedAttempt {
  kind: FailureKind;
  status?: number;
  timedOut: boolean;
  /** Text of this attempt already reached the client. */
  emittedText: boolean;
  /** The model's circuit breaker is open (possibly opened by this failure). */
  circuitOpen: boolean;
  /** 1-based attempt number on this model. */
  attemptOnModel: number;
  /** Attempts allowed on this model for this kind of failure. */
  limit: number;
}
