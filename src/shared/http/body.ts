import type { IncomingMessage } from 'http';
import { PayloadTooLargeError } from './errors/body.errors';
import { parseJson } from './helpers/body.helper';

/** Buffers the request body (rejecting past `limitBytes`) and parses it as JSON. */
export async function readJsonBody(req: IncomingMessage, limitBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > limitBytes) throw new PayloadTooLargeError(limitBytes);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf-8');
  if (!text.trim()) return {};
  return parseJson(text);
}
