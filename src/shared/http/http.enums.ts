export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  DELETE = 'DELETE',
  OPTIONS = 'OPTIONS',
}

export enum HttpStatus {
  OK = 200,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}

/** Node lower-cases incoming header names. */
export enum HttpHeader {
  AUTHORIZATION = 'authorization',
  CONFIRM = 'x-confirm',
  CONTENT_TYPE = 'Content-Type',
}

export enum ContentType {
  JSON = 'application/json',
}
