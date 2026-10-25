import { ErrorCode } from './enums/errorCode.enums';

/**
 * Base class for errors raised on purpose by domain/application code.
 * Layers throw a subclass from a guard (`if (!x) throw new XError(...)`);
 * only the HTTP router and the poll scheduler catch, and they map `code`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = ErrorCode.VALIDATION;
}

export class NotFoundError extends DomainError {
  readonly code = ErrorCode.NOT_FOUND;
}

export class ConflictError extends DomainError {
  readonly code = ErrorCode.CONFLICT;
}

export class ConfigurationError extends DomainError {
  readonly code = ErrorCode.CONFIGURATION;
}

export class ServiceDisabledError extends DomainError {
  readonly code = ErrorCode.SERVICE_DISABLED;
}

/** An external system (AI provider, Canvas, Pinecone, Neon) answered with a failure. */
export class UpstreamError extends DomainError {
  readonly code = ErrorCode.UPSTREAM_FAILURE;

  constructor(message: string, readonly status?: number, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class TimeoutError extends DomainError {
  readonly code = ErrorCode.TIMEOUT;
}
