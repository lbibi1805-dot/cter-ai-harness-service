import type { ServerResponse } from 'http';
import { ContentType, HttpHeader, type HttpStatus } from './http.enums';

export function sendJson(res: ServerResponse, status: HttpStatus, body: unknown): void {
  res.writeHead(status, { [HttpHeader.CONTENT_TYPE]: ContentType.JSON });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, status: HttpStatus, message: string): void {
  sendJson(res, status, { error: message });
}
