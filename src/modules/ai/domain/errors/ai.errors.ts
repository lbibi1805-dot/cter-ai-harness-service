import { ConfigurationError, UpstreamError, ValidationError } from '../../../../shared/errors';
import type { FailureKind } from '../../../../shared/resilience/enums/resilience.enums';

/** Every model in the chain failed (or a fatal error stopped the chain early). */
export class AIInvocationError extends UpstreamError {
  constructor(
    message: string,
    readonly kind: FailureKind,
    readonly attempts: number,
    readonly lastModel: string,
  ) {
    super(message);
  }
}

export class ProviderNotConfiguredError extends ConfigurationError {
  constructor(readonly envVar: string) {
    super(`${envVar} not configured`);
  }
}

/** The provider answered 200 but with no text (or with an `error` body, as OpenRouter can). Retried as transient. */
export class EmptyProviderResponseError extends UpstreamError {}

export class UnsupportedModelError extends ValidationError {
  constructor(provider: string, model: string, allowed: readonly string[]) {
    super(`Model "${model}" is not supported for provider ${provider}. Allowed: ${allowed.join(', ')}`);
  }
}
