/** Next step after a failed adapter attempt. */
export enum AttemptDecision {
  RETRY_SAME = 'retry-same',
  NEXT_MODEL = 'next-model',
  STOP = 'stop',
}
