import type { ILogger } from '../../../domain/ports/ILogger';

export class PollingController {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private isPolling = false;
  constructor(private pollFn: () => Promise<void>, private pollIntervalMs: number, private logger: ILogger) {}
  start(): void {
    this.running = true;
    this.run();
    this.timer = setInterval(() => { if (this.running) this.run(); }, this.pollIntervalMs);
    this.logger.info('Polling started');
  }
  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.running = false;
    this.logger.info('Polling stopped — in-flight jobs will finish');
  }
  private run(): void {
    if (this.isPolling) return;
    this.isPolling = true;
    this.pollFn().catch(console.error).finally(() => { this.isPolling = false; });
  }
  isRunning(): boolean { return this.running; }
}
