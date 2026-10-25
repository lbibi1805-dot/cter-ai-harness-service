import nodemailer from 'nodemailer';
import { errorMessage } from '../../../shared/errors';
import { logger } from '../../../shared/logging/logger';
import { attempt } from '../../../shared/resilience/attempt';
import type { GmailCredentials, Notifier } from '../domain/interfaces/notifier.port';
import { NODEMAILER_SERVICE } from './constants/gmailNotifier.constants';

/** Gmail SMTP with an app password. Without credentials every notification is a no-op. */
export class GmailNotifier implements Notifier {
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly from: string = '';

  constructor({ user, appPassword }: GmailCredentials) {
    if (!user || !appPassword) return;
    this.from = user;
    this.transporter = nodemailer.createTransport({ service: NODEMAILER_SERVICE, auth: { user, pass: appPassword } });
  }

  private get enabled(): boolean {
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

  /** A failed email is logged and swallowed: notifications must never break processing. */
  private async send(to: string, mail: { subject: string; html: string }): Promise<void> {
    const transporter = this.transporter;
    if (!transporter) return;
    const sent = await attempt(() => transporter.sendMail({ from: this.from, to, ...mail }));
    if (sent.ok) logger.emailSent(to, mail.subject);
    else logger.emailFailed(to, errorMessage(sent.error));
  }
}
