import * as http from 'http';
import type { AddressInfo } from 'net';
import { applyCors } from '../shared/http/cors';
import { HttpMethod, HttpStatus } from '../shared/http/enums/http.enums';
import { sendError } from '../shared/http/response';
import type { Router } from '../shared/http/router';
import { logger } from '../shared/logging/logger';
import { URL_BASE } from './constants/bootstrap.constants';

/**
 * Thin dispatcher: CORS, preflight, then the first module router that owns
 * the path. Each module's router handles auth, methods and errors itself.
 */
export class HttpServer {
  private readonly server: http.Server;

  constructor(
    private readonly port: number,
    private readonly routers: readonly Router[],
    private readonly corsOrigins: readonly string[],
  ) {
    this.server = http.createServer((req, res) => void this.handle(req, res));
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info(`API server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /** The bound address (port 0 in tests picks a free port). */
  address(): AddressInfo | string | null {
    return this.server.address();
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    applyCors(req, res, this.corsOrigins);
    if (req.method === HttpMethod.OPTIONS) {
      res.writeHead(HttpStatus.NO_CONTENT);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', URL_BASE);
    const router = this.routers.find((candidate) => candidate.matches(url.pathname));
    if (!router) return sendError(res, HttpStatus.NOT_FOUND, 'Not found');
    await router.dispatch(req, res, url);
  }
}
