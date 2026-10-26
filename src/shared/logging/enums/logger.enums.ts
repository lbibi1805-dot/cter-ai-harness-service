export enum LogLevel {
  INFO = 'info',
  OK = 'ok',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

/** Column tag printed before every console line. */
export enum LogTag {
  STARTUP = 'STARTUP',
  INTERVAL = 'INTERVAL',
  FETCH = 'FETCH',
  SKIP = 'SKIP',
  CHECK = 'CHECK',
  VALIDATE = 'VALIDATE',
  DOWNLOAD = 'DOWNLOAD',
  EXTRACT = 'EXTRACT',
  AI = 'AI',
  UPLOAD = 'UPLOAD',
  OK = 'OK',
  RETRY = 'RETRY',
  FAILED = 'FAILED',
  INVALID = 'INVALID',
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
}

/** Why the file Q&A job ignored a Canvas file. */
export enum SkipReason {
  DONE_ON_CANVAS = 'done-on-canvas',
  IN_STATE = 'in-state',
  IS_RESULT = 'is-result',
  INVALID_NAME = 'invalid-name',
}

/** ANSI escape sequences; the logger has no colour dependency. */
export enum AnsiStyle {
  RESET = '\x1b[0m',
  BOLD = '\x1b[1m',
  GRAY = '\x1b[90m',
  GREEN = '\x1b[32m',
  YELLOW = '\x1b[33m',
  RED = '\x1b[31m',
  CYAN = '\x1b[36m',
  BLUE = '\x1b[34m',
  MAGENTA = '\x1b[35m',
  CLEAR_SCREEN = '\x1bc',
}
