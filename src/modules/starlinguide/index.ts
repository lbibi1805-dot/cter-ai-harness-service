import { Router } from '../../shared/http/router';
import { logger } from '../../shared/logging/logger';
import type { CaptureKeys, CaptureService } from '../capture';
import { STARLINGUIDE_LOG_PREFIX } from './application/constants/starlinguideForwarder.constants';
import { StarlinguideForwarder } from './application/starlinguideForwarder.service';
import { StarlinguideHttpClient } from './infrastructure/starlinguideHttp.client';
import { StarlinguideController } from './presentation/starlinguide.controller';
import { createStarlinguideRoutes } from './presentation/starlinguide.routes';
import type { StarlinguideSettings, StarlinguideForwarderDeps } from './interfaces/starlinguideModule.interface';

export type { StarlinguideSettings, StarlinguideForwarderDeps } from './interfaces/starlinguideModule.interface';

/** Host only (for logs and status): never the path or the secret. */
export function starlinguideHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'invalid-url';
  }
}

/** The forwarder is the capture module's image sink: new uploads only, never the photos already in the bucket. */
export function createStarlinguideForwarder(settings: StarlinguideSettings, deps: StarlinguideForwarderDeps): StarlinguideForwarder {
  const client = deps.client ?? new StarlinguideHttpClient({ baseUrl: settings.baseUrl, secret: settings.secret, timeoutMs: settings.timeoutMs });
  const host = starlinguideHost(settings.baseUrl);
  logger.info(`${STARLINGUIDE_LOG_PREFIX} enabled · ${host} · ${settings.emails.length} email(s) · flush ${settings.flushDelayMs} ms · new uploads only`);
  return new StarlinguideForwarder(client, deps.images, {
    emails: settings.emails,
    flushDelayMs: settings.flushDelayMs,
    host,
    ...(deps.now ? { now: deps.now } : {}),
  });
}

/** Operator routes; mount BEFORE the capture router (see createStarlinguideRoutes). */
export function createStarlinguideRouter(forwarder: StarlinguideForwarder | null, captures: CaptureService | null, keys: CaptureKeys): Router {
  return new Router(createStarlinguideRoutes(new StarlinguideController(forwarder, captures, keys)), undefined);
}

export { StarlinguideForwarder } from './application/starlinguideForwarder.service';
export { StarlinguideHttpClient } from './infrastructure/starlinguideHttp.client';
export * from './application/constants/starlinguideForwarder.constants';
export type * from './application/interfaces/starlinguideForwarder.interface';
export { StarlinguideApiPath } from './presentation/enums/starlinguide.enums';
export * from './domain';
