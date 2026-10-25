import type { IncomingMessage, ServerResponse } from 'http';
import { type HttpMethod } from '../enums/http.enums';

export type RouteParams = Record<string, string>;

export type QueryParams = Record<string, string>;

export interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: RouteParams;
  query: QueryParams;
}

export type RouteHandler = (ctx: RouteContext) => Promise<void>;

export type PathMatcher = (pathname: string) => RouteParams | null;

export interface Route {
  method: HttpMethod;
  match: PathMatcher;
  requiresAuth?: boolean;
  handler: RouteHandler;
}
