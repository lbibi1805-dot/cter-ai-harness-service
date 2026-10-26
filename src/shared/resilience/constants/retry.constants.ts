import { BackoffOptions } from '../interfaces/retry.interface';

export const DEFAULT_BACKOFF: BackoffOptions = { baseDelayMs: 1000, maxDelayMs: 30_000, factor: 2 };
