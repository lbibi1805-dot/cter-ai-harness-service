import type { IncomingMessage, ServerResponse } from 'http';
import { isAuthorized } from './auth';
import { HttpStatus, type HttpMethod } from './http.enums';
import { sendError } from './response';

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

export function exactPath(path: string): PathMatcher {
  return (pathname) => (pathname === path ? {} : null);
}

/** Matches `<prefix><anything><suffix>` and exposes the decoded middle as `params.path`. */
export function wildcardPath(prefix: string, suffix = ''): PathMatcher {
  return (pathname) => {
    if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
    if (pathname.length <= prefix.length + suffix.length) return null;
    return { path: decodeURIComponent(pathname.slice(prefix.length, pathname.length - suffix.length)) };
  };
}

/** First matching route wins; a path match with the wrong method yields 405. */
export class Router {
  constructor(
    private readonly routes: Route[],
    private readonly adminToken: string | undefined,
  ) {}

  async dispatch(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const query: QueryParams = Object.fromEntries(url.searchParams.entries());
    let pathMatched = false;

    for (const route of this.routes) {
      const params = route.match(url.pathname);
      if (!params) continue;
      pathMatched = true;
      if (route.method !== req.method) continue;

      if (route.requiresAuth && !isAuthorized(req, this.adminToken)) {
        sendError(res, HttpStatus.UNAUTHORIZED, 'Unauthorized');
        return;
      }
      try {
        await route.handler({ req, res, params, query });
      } catch (err) {
        sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, (err as Error).message);
      }
      return;
    }

    if (pathMatched) sendError(res, HttpStatus.METHOD_NOT_ALLOWED, 'Method not allowed');
    else sendError(res, HttpStatus.NOT_FOUND, 'Not found');
  }
}
