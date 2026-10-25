import { LogLevel, LogTag } from '../enums/logger.enums';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: LogTag;
  msg: string;
  line: string;
}
