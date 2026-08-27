import * as http from 'http';
import type { AppConfig } from '../types';
import { validateAllKeys, type KeyValidationResult } from '../ai/aiRouter';
import { EmailNotifier } from '../utils/emailNotifier';
import { logger } from '../utils/logger';

type PollFn = () => Promise<void>;

function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return maskEmailName(email);

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  return `${maskEmailName(localPart)}@${domain}`;
}

function maskEmailName(value: string): string {
  if (value.length <= 1) return '*';
  if (value.length <= 4) return `${value.slice(0, 2)}***`;

  return `${value.slice(0, 2)}${'*'.repeat(Math.max(3, value.length - 4))}${value.slice(-2)}`;
}

export class ApiServer {
  private server: http.Server;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private isPolling = false;

  constructor(
    private pollFn: PollFn,
    private config: AppConfig,
    private emailNotifier: EmailNotifier,
    private port: number,
  ) {
    this.server = http.createServer((req, res) => this.handle(req, res));
  }

  start(): void {
    this.server.listen(this.port, () => {
      logger.info(`API server listening on port ${this.port}`);
    });
  }

  private runPoll(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollFn()
      .catch(console.error)
      .finally(() => { this.isPolling = false; });
  }

  startPolling(): void {
    this.running = true;
    this.runPoll();
    this.timer = setInterval(() => {
      if (!this.running) return;
      this.runPoll();
    }, this.config.pollIntervalMs);
    logger.info('Polling started');
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info('Polling stopped — in-flight jobs will finish');
  }

  private notifyUsersWhenStartOrStop(action: 'started' | 'paused'): void {
    //TODO: Remove this in production. Currently stop to avoid spamming
    return;

    const emails = [
      ...new Set(
        this.config.accounts
          .map((account) => account.email)
          .filter((email): email is string => Boolean(email)),
      ),
    ];

    void Promise.all(
      emails.map((email) => (
        action === 'started'
          ? this.emailNotifier.notifyPollingStarted(email)
          : this.emailNotifier.notifyPollingPaused(email)
      )),
    );
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const path = req.url?.split('?')[0] ?? '/';

    if (path === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'up',
        polling: this.running ? 'running' : 'stopped',
        canvasAccounts: this.config.accounts.map((account) => ({
          index: account.index,
          email: account.email ? maskEmail(account.email) : null,
        })),
      }));
      return;
    }

    if (path === '/start') {
      if (this.running) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'already_running' }));
        return;
      }
      validateAllKeys(this.config.aiKeys, this.config.grokBaseUrl)
        .then((results: KeyValidationResult[]) => {
          this.startPolling();
          this.notifyUsersWhenStartOrStop('started');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'started', validation: results }));
        })
        .catch((err: Error) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      return;
    }

    if (path === '/stop') {
      if (!this.running) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'already_stopped' }));
        return;
      }
      this.stopPolling();
      this.notifyUsersWhenStartOrStop('paused');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopped' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}
