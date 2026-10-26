import { DomainError, ErrorCode, ValidationError } from '../../errors';

export class PayloadTooLargeError extends DomainError {
  readonly code = ErrorCode.PAYLOAD_TOO_LARGE;

  constructor(limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes`);
  }
}

export class InvalidJsonError extends ValidationError {
  constructor() {
    super('Request body is not valid JSON');
  }
}
