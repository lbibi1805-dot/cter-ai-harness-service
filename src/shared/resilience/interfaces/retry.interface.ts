import { FailureKind } from '../enums/resilience.enums';

export type Sleep = (ms: number) => Promise<void>;

export interface BackoffOptions {
  baseDelayMs: number;
  maxDelayMs: number;
  factor: number;
}

export interface RetryOptions {
  maxAttempts: number;
  sleep?: Sleep;
  backoff?: BackoffOptions;
  onRetry?: (attempt: number, err: unknown, kind: FailureKind, delayMs: number) => void;
}

export interface FallbackPolicy {
  /** Tries per target for a failure of this kind (PERMANENT always moves on after one). */
  attemptsPerTarget(kind: FailureKind): number;
  sleep?: Sleep;
  backoff?: BackoffOptions;
  onAttempt?: (target: string) => void;
  onRetry?: (target: string, attemptOnTarget: number, err: unknown, kind: FailureKind, delayMs: number) => void;
  onFallback?: (from: string, to: string, err: unknown, kind: FailureKind) => void;
}

export interface FallbackSuccess<T> {
  value: T;
  target: string;
  attempts: number;
}

export interface FallbackFailure {
  error: unknown;
  kind: FailureKind;
  attempts: number;
  target: string;
}
