import type { IncomingMessage, ServerResponse } from 'http';
import { errorMessage } from '../errors';
import { isAuthorized } from './auth';
import { HttpStatus } from './enums/http.enums';
import { httpStatusFor } from './httpErrorStatus';
import { sendError } from './response';
import { Route, QueryParams, RouteHandler, RouteContext } from './interfaces/router.interface';

/** First matching route wins; a path match with the wrong method yields 405. */
export class Router {
  constructor(
    private readonly routes: Route[],
    private readonly adminToken: string | undefined,
  ) {}

  /** True when some route owns this path (whatever the method). */
  matches(pathname: string): boolean {
    return this.routes.some((route) => route.match(pathname) !== null);
  }

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
      await this.runHandler(route.handler, { req, res, params, query });
      return;
    }

    if (pathMatched) sendError(res, HttpStatus.METHOD_NOT_ALLOWED, 'Method not allowed');
    else sendError(res, HttpStatus.NOT_FOUND, 'Not found');
  }

  /**
   * The HTTP error boundary: handlers throw DomainError subclasses from guards
   * and this is the one place they become a status code.
   */
  private async runHandler(handler: RouteHandler, ctx: RouteContext): Promise<void> {
    try {
      await handler(ctx);
    } catch (err) {
      sendError(ctx.res, httpStatusFor(err), errorMessage(err));
    }
  }
}
