import { ErrorCode } from '../../errors';
import { HttpStatus } from '../enums/http.enums';

export const STATUS_BY_ERROR_CODE: Record<ErrorCode, HttpStatus> = {
  [ErrorCode.VALIDATION]: HttpStatus.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
  [ErrorCode.PAYLOAD_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.CONFIGURATION]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.SERVICE_DISABLED]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.UPSTREAM_FAILURE]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
};
