/** Operator routes (capture key or ADMIN_TOKEN). Under `/api/captures` so the capture CORS rules apply. */
export enum StarlinguideApiPath {
  STATUS = '/api/captures/starlinguide/status',
  BATCH_PREFIX = '/api/captures/batches/',
  REPUSH_SUFFIX = '/starlinguide',
}
