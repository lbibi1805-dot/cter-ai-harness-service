import { ConfigurationError, UpstreamError, ValidationError } from '../../../../shared/errors';
import type { FailureKind } from '../../../../shared/resilience/enums/resilience.enums';

/** Every model in the chain failed (or a fatal error stopped the chain early). */
export class AIInvocationError extends UpstreamError {
  constructor(
    message: string,
    readonly kind: FailureKind,
    readonly attempts: number,
    readonly lastModel: string,
    /** Finer reason for metrics, e.g. `deadline`; defaults to `kind`. */
    readonly errorKind: string = kind,
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

/**
 * HTTP 413: the request's images are over GEMINI_INLINE_IMAGES_MAX_MB and the Gemini Files API upload
 * (the way around the inline limit) failed too. Not retried on the same model.
 */
export class InlineImagesTooLargeError extends UpstreamError {
  constructor(totalBytes: number, limitBytes: number, reason: string) {
    super(
      `413 Images total ${(totalBytes / (1024 * 1024)).toFixed(1)} MB, over the ${(limitBytes / (1024 * 1024)).toFixed(1)} MB inline limit, `
      + `and the Gemini Files API upload failed (${reason}). Compress the images or send fewer, then retry.`,
      413,
    );
  }
}
