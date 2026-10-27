export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
}

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  PAYLOAD_TOO_LARGE = 413,
  TOO_EARLY = 425,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

/** Node lower-cases incoming header names. */
export enum HttpHeader {
  AUTHORIZATION = 'authorization',
  CONFIRM = 'x-confirm',
  CONTENT_TYPE = 'Content-Type',
  ACCEPT = 'Accept',
  LINK = 'Link',
  CACHE_CONTROL = 'Cache-Control',
  /** Tells nginx-style proxies (Render) not to buffer a streamed response. */
  ACCEL_BUFFERING = 'X-Accel-Buffering',
}

export enum ContentType {
  JSON = 'application/json',
  FORM_URLENCODED = 'application/x-www-form-urlencoded',
  PDF = 'application/pdf',
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  HTML = 'text/html; charset=utf-8',
  /** One JSON event per line (streamed answers). */
  NDJSON = 'application/x-ndjson; charset=utf-8',
}
