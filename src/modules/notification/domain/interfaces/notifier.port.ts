/** Outbound notifications about processing results. Best effort: never throws. */
export interface Notifier {
  notifySuccess(to: string, originalName: string, doneFileName: string, provider: string, model: string): Promise<void>;
  notifyError(to: string, originalName: string, provider: string, model: string, error: string): Promise<void>;
}

export interface GmailCredentials {
  user?: string;
  appPassword?: string;
}
