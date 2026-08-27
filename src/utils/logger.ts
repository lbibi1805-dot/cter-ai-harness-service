// ANSI color codes — no extra dependencies
const R  = '\x1b[0m';   // reset
const BOLD   = '\x1b[1m';
const GRAY   = '\x1b[90m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const BLUE   = '\x1b[34m';
const MAGENTA = '\x1b[35m';

type Level = 'info' | 'ok' | 'warn' | 'error' | 'debug';

const LEVEL_COLOR: Record<Level, string> = {
  info:  CYAN,
  ok:    GREEN,
  warn:  YELLOW,
  error: RED,
  debug: GRAY,
};

// Tags padded to 10 chars for column alignment
const TAG: Record<string, string> = {
  STARTUP:  BOLD  + BLUE,
  INTERVAL: BOLD  + CYAN,
  FETCH:    CYAN,
  SKIP:     GRAY,
  CHECK:    BLUE,
  VALIDATE: MAGENTA,
  DOWNLOAD: CYAN,
  EXTRACT:  CYAN,
  AI:       MAGENTA,
  UPLOAD:   CYAN,
  OK:       GREEN,
  RETRY:    YELLOW,
  FAILED:   RED,
  INVALID:  RED,
  ERROR:    RED,
  WARN:     YELLOW,
};

const MAX_LINES = 200;

class Logger {
  private lineCount = 0;

  private ts(): string {
    return new Date().toISOString().replace('T', ' ').slice(0, 23);
  }

  private write(level: Level, tag: string, msg: string): void {
    if (this.lineCount >= MAX_LINES) {
      process.stdout.write('\x1bc'); // clear terminal
      this.lineCount = 0;
    }
    const color = TAG[tag] ?? LEVEL_COLOR[level];
    const paddedTag = tag.padEnd(10);
    process.stdout.write(
      `${GRAY}[${this.ts()}]${R} ${color}[${paddedTag}]${R} ${msg}\n`
    );
    this.lineCount += 1;
  }

  // ── Lifecycle ────────────────────────────────────────────────
  startup(accounts: number, intervalMs: number): void {
    this.write('info', 'STARTUP',
      `${BOLD}Canvas File Helper started${R} — accounts: ${BOLD}${accounts}${R}, interval: ${BOLD}${intervalMs}ms${R}`);
  }

  interval(count: number): void {
    this.write('info', 'INTERVAL',
      `${BOLD}Poll #${count}${R} starting`);
  }

  // ── Canvas API ───────────────────────────────────────────────
  fetch(accountIndex: number, url: string): void {
    this.write('info', 'FETCH',
      `Account ${BOLD}#${accountIndex}${R} — listing files from ${GRAY}${url}${R}`);
  }

  fetchDone(accountIndex: number, count: number): void {
    this.write('info', 'FETCH',
      `Account ${BOLD}#${accountIndex}${R} — ${BOLD}${count}${R} files received`);
  }

  fetchError(accountIndex: number, error: string): void {
    this.write('error', 'ERROR',
      `Account #${accountIndex} list failed: ${RED}${error}${R}`);
  }

  // ── Per-file checks ──────────────────────────────────────────
  skip(fileName: string, reason: 'done-on-canvas' | 'in-state' | 'is-result' | 'invalid-name'): void {
    const reasons = {
      'done-on-canvas': 'DONE - already on Canvas',
      'in-state':       'already processed (local state)',
      'is-result':      'is a _DONE result file',
      'invalid-name':   'does not match START_<name>_<provider>[_model].<ext>',
    };
    this.write('debug', 'SKIP', `${GRAY}${fileName}${R} — ${reasons[reason]}`);
  }

  check(fileName: string): void {
    this.write('info', 'CHECK',
      `${BOLD}${fileName}${R} — queued for processing`);
  }

  // ── Validation ───────────────────────────────────────────────
  validateOk(fileName: string, provider: string, model: string): void {
    this.write('info', 'VALIDATE',
      `${fileName} — ${MAGENTA}${provider}/${model}${R} ${GREEN}✓${R}`);
  }

  validateFail(fileName: string, provider: string, model: string, allowed: string[]): void {
    this.write('warn', 'VALIDATE',
      `${fileName} — model ${RED}"${model}"${R} invalid for ${provider}. Allowed: ${allowed.join(', ')}`);
  }

  // ── Pipeline steps ───────────────────────────────────────────
  download(fileName: string): void {
    this.write('info', 'DOWNLOAD', fileName);
  }

  extract(fileName: string, extension: string): void {
    this.write('info', 'EXTRACT',
      `${fileName} — extension ${CYAN}${extension}${R}`);
  }

  ai(provider: string, model: string, fileName: string): void {
    this.write('info', 'AI',
      `${MAGENTA}${provider}/${model}${R} ← ${fileName}`);
  }

  upload(doneFileName: string): void {
    this.write('info', 'UPLOAD', `${doneFileName} → Canvas`);
  }

  // ── Results ──────────────────────────────────────────────────
  ok(originalName: string, doneFileName: string): void {
    this.write('ok', 'OK',
      `${GREEN}${originalName}${R} → ${GREEN}${doneFileName}${R}`);
  }

  retry(attempt: number, max: number, fileName: string, error: string): void {
    this.write('warn', 'RETRY',
      `[${attempt}/${max}] ${fileName} — ${YELLOW}${error}${R}`);
  }

  fallback(provider: string, fromModel: string, toModel: string, fileName: string, reason: string): void {
    this.write('warn', 'WARN',
      `${fileName} — ${MAGENTA}${provider}${R} fallback ${RED}${fromModel}${R} → ${GREEN}${toModel}${R} (${reason})`);
  }

  failed(fileName: string, error: string): void {
    this.write('error', 'FAILED',
      `${RED}${fileName}${R} — ${error}`);
  }

  invalidModel(fileName: string, provider: string, model: string): void {
    this.write('warn', 'INVALID',
      `${fileName} — model ${RED}"${model}"${R} not supported for ${provider}`);
  }

  folderSkip(accountIndex: number, reason: string): void {
    this.write('debug', 'SKIP',
      `Account #${accountIndex} — ${GRAY}${reason}${R}`);
  }

  folderFound(name: string, id: number): void {
    this.write('info', 'FETCH',
      `Folder ${BOLD}${name}${R} found (id: ${id})`);
  }

  folderCreated(name: string, id: number): void {
    this.write('ok', 'OK',
      `Folder ${GREEN}${name}${R} created (id: ${id})`);
  }

  staleReset(fileName: string, stuckSince: string): void {
    this.write('warn', 'WARN',
      `${YELLOW}${fileName}${R} stuck in processing since ${stuckSince} — reset to pending`);
  }

  uploadErrorFailed(doneFileName: string, error: string): void {
    this.write('error', 'ERROR',
      `Could not upload error file ${doneFileName}: ${error}`);
  }

  // ── Generic ──────────────────────────────────────────────────
  info(msg: string): void {
    this.write('info', 'INFO', msg);
  }

  // ── Email notifications ──────────────────────────────────────
  emailSent(to: string, subject: string): void {
    this.write('ok', 'OK',
      `Email sent to ${CYAN}${to}${R} — ${GRAY}${subject}${R}`);
  }

  emailFailed(to: string, error: string): void {
    this.write('error', 'ERROR',
      `Email to ${to} failed: ${RED}${error}${R}`);
  }
}

export const logger = new Logger();
