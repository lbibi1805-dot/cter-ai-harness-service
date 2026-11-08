import type { IncomingMessage } from 'http';
import { PayloadTooLargeError } from './errors/body.errors';
import { parseJson } from './helpers/body.helper';

/** Buffers the raw request body, rejecting past `limitBytes` (HTTP 413). */
export async function readRawBody(req: IncomingMessage, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limitBytes) throw new PayloadTooLargeError(limitBytes);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Buffers the request body (rejecting past `limitBytes`) and parses it as JSON. */
export async function readJsonBody(req: IncomingMessage, limitBytes: number): Promise<unknown> {
  const text = (await readRawBody(req, limitBytes)).toString('utf-8');
  if (!text.trim()) return {};
  return parseJson(text);
}
