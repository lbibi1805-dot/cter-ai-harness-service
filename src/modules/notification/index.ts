import type { GmailCredentials, Notifier } from './domain/interfaces/notifier.port';
import { GmailNotifier } from './infrastructure/gmailNotifier.adapter';

export function createNotifier(credentials: GmailCredentials): Notifier {
  return new GmailNotifier(credentials);
}

export type { GmailCredentials, Notifier } from './domain/interfaces/notifier.port';
export { GmailNotifier } from './infrastructure/gmailNotifier.adapter';
