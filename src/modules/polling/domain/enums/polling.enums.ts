export enum PollJobName {
  FILE_QA = 'file-qa',
  CONVERSATION = 'conversation',
}

/** Values are part of the public API (`GET /`, `/health`, `/api/polling`). */
export enum SchedulerState {
  RUNNING = 'running',
  STOPPED = 'stopped',
}

/** Values are part of the public API (`GET /start`). */
export enum StartOutcome {
  STARTED = 'started',
  ALREADY_RUNNING = 'already_running',
}

/** Values are part of the public API (`GET /stop`). */
export enum StopOutcome {
  STOPPED = 'stopped',
  ALREADY_STOPPED = 'already_stopped',
}
