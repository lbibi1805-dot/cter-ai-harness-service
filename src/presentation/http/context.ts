import * as http from 'http';

/** Shared per-request context routers need — moved out of `ApiServer` fields
 * (Phase 1, mục 4.A). Behavior unchanged; this only threads through what each
 * router previously read via `this.*` on the `ApiServer` instance. */
export interface HttpRouterContext {
  config: import('../../types').AppConfig;
  port: number;
  isRunning(): boolean;
  startPolling(): void;
  stopPolling(): void;
  notifyUsersWhenStartOrStop(action: 'started' | 'paused'): void;
}

export type QueryParams = Record<string, string>;
export type HttpHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  query: QueryParams,
  ctx: HttpRouterContext,
) => Promise<boolean>;
