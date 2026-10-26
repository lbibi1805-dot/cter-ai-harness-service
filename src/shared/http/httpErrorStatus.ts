import { DomainError } from '../errors';
import { HttpStatus } from './enums/http.enums';
import { STATUS_BY_ERROR_CODE } from './constants/httpErrorStatus.constants';

/** Domain errors carry their own status; anything else is an unexpected 500. */
export function httpStatusFor(err: unknown): HttpStatus {
  return err instanceof DomainError ? STATUS_BY_ERROR_CODE[err.code] : HttpStatus.INTERNAL_SERVER_ERROR;
}
