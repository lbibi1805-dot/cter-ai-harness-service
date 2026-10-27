import type { ServerResponse } from 'http';
import { ContentType, HttpHeader, HttpStatus } from './enums/http.enums';
import { NdjsonEventType } from './enums/ndjson.enums';
import { ACCEL_BUFFERING_OFF, STREAM_CACHE_CONTROL } from './constants/ndjson.constants';

/**
 * Newline-delimited JSON over one HTTP response: each `write` is one event the client can act on as it arrives
 * (answer deltas, progress). The status is 200 once the first byte is out, so a later failure becomes an
 * `{ "type": "error" }` event (see Router.runHandler).
 */
export class NdjsonStream {
  constructor(private readonly res: ServerResponse) {}

  open(): void {
    if (this.res.headersSent) return;
    this.res.writeHead(HttpStatus.OK, {
      [HttpHeader.CONTENT_TYPE]: ContentType.NDJSON,
      [HttpHeader.CACHE_CONTROL]: STREAM_CACHE_CONTROL,
      [HttpHeader.ACCEL_BUFFERING]: ACCEL_BUFFERING_OFF,
    });
    this.res.flushHeaders();
  }

  write(event: object): void {
    this.open();
    this.res.write(`${JSON.stringify(event)}
`);
  }

  end(event?: object): void {
    if (event) this.write(event);
    this.res.end();
  }
}

export function endStreamWithError(res: ServerResponse, status: HttpStatus, message: string): void {
  if (res.writableEnded) return;
  res.end(`${JSON.stringify({ type: NdjsonEventType.ERROR, status, error: message })}
`);
}
