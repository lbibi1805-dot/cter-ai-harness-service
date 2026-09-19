import type { ILogger } from '../../../domain/ports/ILogger';

export class LogsController {
  constructor(private logger: ILogger) {}
  getLogs(limit = 100) { return this.logger.getLogs(limit); }
  clear(): void { this.logger.clear(); }
  aiUsage(defaults: any, fallback: any) {
    return {
      providers: fallback,
      defaults,
      aiCalls: this.logger.getLogs(500).filter(l => l.tag === 'AI').length,
      lastLogs: this.logger.getLogs(20).filter(l => l.tag === 'AI' || l.tag === 'RETRY' || l.tag === 'FAILED').slice(-10),
    };
  }
}
