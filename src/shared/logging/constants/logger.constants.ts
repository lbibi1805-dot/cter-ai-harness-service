import { AnsiStyle, LogLevel, LogTag, SkipReason } from '../enums/logger.enums';

/** The console is cleared after this many lines so a long-running daemon stays readable. */
export const MAX_CONSOLE_LINES = 200;

/** Recent lines kept in memory for `GET /api/logs`. */
export const LOG_BUFFER_SIZE = 500;

export const DEFAULT_LOG_QUERY_LIMIT = 100;

export const TAG_COLUMN_WIDTH = 10;

/** `YYYY-MM-DD HH:mm:ss.SSS`: the ISO timestamp without the zone suffix. */
export const TIMESTAMP_LENGTH = 23;

export const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export const SKIP_REASON_TEXT: Record<SkipReason, string> = {
  [SkipReason.DONE_ON_CANVAS]: 'DONE - already on Canvas',
  [SkipReason.IN_STATE]: 'already processed (local state)',
  [SkipReason.IS_RESULT]: 'is a _DONE result file',
  [SkipReason.INVALID_NAME]: 'does not match START_<name>_<provider>[_model].<ext>',
};

export const { RESET: R, BOLD, GRAY, GREEN, YELLOW, RED, CYAN, BLUE, MAGENTA } = AnsiStyle;

export const LEVEL_COLOR: Record<LogLevel, string> = {
  [LogLevel.INFO]: CYAN,
  [LogLevel.OK]: GREEN,
  [LogLevel.WARN]: YELLOW,
  [LogLevel.ERROR]: RED,
  [LogLevel.DEBUG]: GRAY,
};

export const TAG_COLOR: Partial<Record<LogTag, string>> = {
  [LogTag.STARTUP]: BOLD + BLUE,
  [LogTag.INTERVAL]: BOLD + CYAN,
  [LogTag.FETCH]: CYAN,
  [LogTag.SKIP]: GRAY,
  [LogTag.CHECK]: BLUE,
  [LogTag.VALIDATE]: MAGENTA,
  [LogTag.DOWNLOAD]: CYAN,
  [LogTag.EXTRACT]: CYAN,
  [LogTag.AI]: MAGENTA,
  [LogTag.UPLOAD]: CYAN,
  [LogTag.OK]: GREEN,
  [LogTag.RETRY]: YELLOW,
  [LogTag.FAILED]: RED,
  [LogTag.INVALID]: RED,
  [LogTag.ERROR]: RED,
  [LogTag.WARN]: YELLOW,
};
