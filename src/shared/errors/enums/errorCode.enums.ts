/** Stable, transport-neutral classification of every error the service raises on purpose. */
export enum ErrorCode {
  VALIDATION = 'validation',
  NOT_FOUND = 'not-found',
  CONFLICT = 'conflict',
  PAYLOAD_TOO_LARGE = 'payload-too-large',
  CONFIGURATION = 'configuration',
  SERVICE_DISABLED = 'service-disabled',
  UPSTREAM_FAILURE = 'upstream-failure',
  TIMEOUT = 'timeout',
}
