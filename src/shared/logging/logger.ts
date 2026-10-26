import { AnsiStyle, LogLevel, LogTag, SkipReason } from './enums/logger.enums';
import { LogEntry } from './interfaces/logger.interface';
import { DEFAULT_LOG_QUERY_LIMIT, TAG_COLUMN_WIDTH, SKIP_REASON_TEXT, MAX_CONSOLE_LINES, TIMESTAMP_LENGTH, ANSI_PATTERN, LOG_BUFFER_SIZE, TAG_COLOR, LEVEL_COLOR, R, BOLD, GRAY, GREEN, YELLOW, RED, CYAN, MAGENTA } from './constants/logger.constants';

class Logger {
  private lineCount = 0;
  private buffer: LogEntry[] = [];

  getLogs(limit = DEFAULT_LOG_QUERY_LIMIT): LogEntry[] {
    return this.buffer.slice(-limit);
  }

  clear(): void {
    this.buffer = [];
  }

  // ── Generic ──────────────────────────────────────────────────
  info(msg: string): void {
    this.write(LogLevel.INFO, LogTag.INFO, msg);
  }

  warn(msg: string): void {
    this.write(LogLevel.WARN, LogTag.WARN, msg);
  }

  error(msg: string): void {
    this.write(LogLevel.ERROR, LogTag.ERROR, msg);
  }

  // ── Lifecycle ────────────────────────────────────────────────
  startup(accounts: number, intervalMs: number): void {
    this.write(LogLevel.INFO, LogTag.STARTUP,
      `${BOLD}Canvas File Helper started${R} — accounts: ${BOLD}${accounts}${R}, interval: ${BOLD}${intervalMs}ms${R}`);
  }

  interval(count: number): void {
    this.write(LogLevel.INFO, LogTag.INTERVAL, `${BOLD}Poll #${count}${R} starting`);
  }

  // ── Canvas API ───────────────────────────────────────────────
  fetch(accountIndex: number, url: string): void {
    this.write(LogLevel.INFO, LogTag.FETCH, `Account ${BOLD}#${accountIndex}${R} — listing files from ${GRAY}${url}${R}`);
  }

  fetchDone(accountIndex: number, count: number): void {
    this.write(LogLevel.INFO, LogTag.FETCH, `Account ${BOLD}#${accountIndex}${R} — ${BOLD}${count}${R} files received`);
  }

  fetchError(accountIndex: number, error: string): void {
    this.write(LogLevel.ERROR, LogTag.ERROR, `Account #${accountIndex} list failed: ${RED}${error}${R}`);
  }

  folderSkip(accountIndex: number, reason: string): void {
    this.write(LogLevel.DEBUG, LogTag.SKIP, `Account #${accountIndex} — ${GRAY}${reason}${R}`);
  }

  folderFound(name: string, id: number): void {
    this.write(LogLevel.INFO, LogTag.FETCH, `Folder ${BOLD}${name}${R} found (id: ${id})`);
  }

  folderCreated(name: string, id: number): void {
    this.write(LogLevel.OK, LogTag.OK, `Folder ${GREEN}${name}${R} created (id: ${id})`);
  }

  // ── Per-file checks ──────────────────────────────────────────
  skip(fileName: string, reason: SkipReason): void {
    this.write(LogLevel.DEBUG, LogTag.SKIP, `${GRAY}${fileName}${R} — ${SKIP_REASON_TEXT[reason]}`);
  }

  check(fileName: string): void {
    this.write(LogLevel.INFO, LogTag.CHECK, `${BOLD}${fileName}${R} — queued for processing`);
  }

  validateOk(fileName: string, provider: string, model: string): void {
    this.write(LogLevel.INFO, LogTag.VALIDATE, `${fileName} — ${MAGENTA}${provider}/${model}${R} ${GREEN}✓${R}`);
  }

  validateFail(fileName: string, provider: string, model: string, allowed: string[]): void {
    this.write(LogLevel.WARN, LogTag.VALIDATE,
      `${fileName} — model ${RED}"${model}"${R} invalid for ${provider}. Allowed: ${allowed.join(', ')}`);
  }

  // ── Pipeline steps ───────────────────────────────────────────
  download(fileName: string): void {
    this.write(LogLevel.INFO, LogTag.DOWNLOAD, fileName);
  }

  extract(fileName: string, extension: string): void {
    this.write(LogLevel.INFO, LogTag.EXTRACT, `${fileName} — extension ${CYAN}${extension}${R}`);
  }

  ai(provider: string, model: string, fileName: string): void {
    this.write(LogLevel.INFO, LogTag.AI, `${MAGENTA}${provider}/${model}${R} ← ${fileName}`);
  }

  upload(doneFileName: string): void {
    this.write(LogLevel.INFO, LogTag.UPLOAD, `${doneFileName} → Canvas`);
  }

  // ── Results ──────────────────────────────────────────────────
  ok(originalName: string, doneFileName: string): void {
    this.write(LogLevel.OK, LogTag.OK, `${GREEN}${originalName}${R} → ${GREEN}${doneFileName}${R}`);
  }

  retry(attempt: number, max: number, fileName: string, error: string): void {
    this.write(LogLevel.WARN, LogTag.RETRY, `[${attempt}/${max}] ${fileName} — ${YELLOW}${error}${R}`);
  }

  fallback(provider: string, fromModel: string, toModel: string, fileName: string, reason: string): void {
    this.write(LogLevel.WARN, LogTag.WARN,
      `${fileName} — ${MAGENTA}${provider}${R} fallback ${RED}${fromModel}${R} → ${GREEN}${toModel}${R} (${reason})`);
  }

  failed(fileName: string, error: string): void {
    this.write(LogLevel.ERROR, LogTag.FAILED, `${RED}${fileName}${R} — ${error}`);
  }

  invalidModel(fileName: string, provider: string, model: string): void {
    this.write(LogLevel.WARN, LogTag.INVALID, `${fileName} — model ${RED}"${model}"${R} not supported for ${provider}`);
  }

  staleReset(fileName: string, stuckSince: string): void {
    this.write(LogLevel.WARN, LogTag.WARN, `${YELLOW}${fileName}${R} stuck in processing since ${stuckSince} — reset to pending`);
  }

  uploadErrorFailed(doneFileName: string, error: string): void {
    this.write(LogLevel.ERROR, LogTag.ERROR, `Could not upload error file ${doneFileName}: ${error}`);
  }

  // ── Email notifications ──────────────────────────────────────
  emailSent(to: string, subject: string): void {
    this.write(LogLevel.OK, LogTag.OK, `Email sent to ${CYAN}${to}${R} — ${GRAY}${subject}${R}`);
  }

  emailFailed(to: string, error: string): void {
    this.write(LogLevel.ERROR, LogTag.ERROR, `Email to ${to} failed: ${RED}${error}${R}`);
  }

  private write(level: LogLevel, tag: LogTag, msg: string): void {
    if (this.lineCount >= MAX_CONSOLE_LINES) {
      process.stdout.write(AnsiStyle.CLEAR_SCREEN);
      this.lineCount = 0;
    }
    const color = TAG_COLOR[tag] ?? LEVEL_COLOR[level];
    const paddedTag = tag.padEnd(TAG_COLUMN_WIDTH);
    const ts = new Date().toISOString().replace('T', ' ').slice(0, TIMESTAMP_LENGTH);
    process.stdout.write(`${GRAY}[${ts}]${R} ${color}[${paddedTag}]${R} ${msg}\n`);
    this.lineCount += 1;

    const plain = msg.replace(ANSI_PATTERN, '');
    this.buffer.push({ ts, level, tag, msg: plain, line: `[${ts}] [${paddedTag}] ${plain}` });
    if (this.buffer.length > LOG_BUFFER_SIZE) this.buffer.shift();
  }
}

export const logger = new Logger();
