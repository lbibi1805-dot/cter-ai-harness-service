import nodemailer from 'nodemailer';
import { logger } from './logger';

export class EmailNotifier {
  private transporter: nodemailer.Transporter | null = null;
  private from: string = '';

  constructor(user?: string, appPassword?: string) {
    if (!user || !appPassword) return;
    this.from = user;
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: appPassword },
    });
  }

  private get enabled() {
    return this.transporter !== null;
  }

  async notifySuccess(
    to: string,
    originalName: string,
    doneFileName: string,
    provider: string,
    model: string,
  ): Promise<void> {
    if (!this.enabled) return;
    await this.send(to, {
      subject: `[Canvas File Helper] Processed: ${originalName}`,
      html: `
        <h2>File processed successfully</h2>
        <table style="border-collapse:collapse;font-family:sans-serif">
          <tr><td style="padding:4px 12px 4px 0;color:#555">Input</td><td><b>${originalName}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Output</td><td><b>${doneFileName}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Provider</td><td>${provider}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Model</td><td>${model}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Time</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p style="color:#888;font-size:12px">The result file has been uploaded to your Canvas Materials/A folder.</p>
      `,
    });
  }

  async notifyError(
    to: string,
    originalName: string,
    provider: string,
    model: string,
    error: string,
  ): Promise<void> {
    if (!this.enabled) return;
    await this.send(to, {
      subject: `[Canvas File Helper] Failed: ${originalName}`,
      html: `
        <h2>File processing failed</h2>
        <table style="border-collapse:collapse;font-family:sans-serif">
          <tr><td style="padding:4px 12px 4px 0;color:#555">File</td><td><b>${originalName}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Provider</td><td>${provider}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Model</td><td>${model}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Error</td><td style="color:#c00">${error}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#555">Time</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p style="color:#888;font-size:12px">An error file has been uploaded to your Canvas Materials/A folder with details.</p>
      `,
    });
  }

  async notifyPollingPaused(to: string): Promise<void> {
    if (!this.enabled) return;
    await this.send(to, {
      subject: '[Canvas File Helper] Polling paused',
      html: `
        <h2>Canvas polling has been paused</h2>
        <p>Một trong số người dùng đã tạm dừng việc polling.</p>
        <p>Bạn có thể sẽ không nhận được AI response cho file mới cho đến khi polling được bật lại.</p>
        <p>Nếu cần bật lại, hãy gọi <code>GET /start</code>.</p>
        <p style="color:#888;font-size:12px">Việc tắt/bật polling như này để tránh spam Canvas APIs.</p>
        <p style="color:#888;font-size:12px">Time: ${new Date().toISOString()}</p>
      `,
    });
  }

  async notifyPollingStarted(to: string): Promise<void> {
    if (!this.enabled) return;
    await this.send(to, {
      subject: '[Canvas File Helper] Polling started',
      html: `
        <h2>Canvas polling has been started</h2>
        <p>Một trong số người dùng đã bật lại việc polling.</p>
        <p>Canvas File Helper sẽ tiếp tục kiểm tra file mới và upload AI response khi xử lý xong.</p>
        <p>Nếu cần tạm dừng để tránh spam Canvas APIs, hãy gọi <code>GET /stop</code>.</p>
        <p style="color:#888;font-size:12px">Time: ${new Date().toISOString()}</p>
      `,
    });
  }

  private async send(to: string, mail: { subject: string; html: string }): Promise<void> {
    try {
      await this.transporter!.sendMail({ from: this.from, to, ...mail });
      logger.emailSent(to, mail.subject);
    } catch (err) {
      logger.emailFailed(to, (err as Error).message);
    }
  }
}
