import type { FailureKind } from '../../../shared/resilience';

/** Every model in the chain failed (or a fatal error stopped the chain early). */
export class AIInvocationError extends Error {
  constructor(
    message: string,
    readonly kind: FailureKind,
    readonly attempts: number,
    readonly lastModel: string,
  ) {
    super(message);
    this.name = 'AIInvocationError';
  }
}
