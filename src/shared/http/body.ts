import type { IncomingMessage } from 'http';

export class PayloadTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super('Request body is not valid JSON');
  }
}

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
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}
