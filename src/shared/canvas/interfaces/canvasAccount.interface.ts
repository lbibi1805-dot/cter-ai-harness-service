/** One Canvas login the service polls (CANVAS_URL_n / CANVAS_KEY_n / CANVAS_EMAIL_n). */
export interface CanvasAccountConfig {
  url: string;
  apiKey: string;
  /** 1-based position in the env (`_1`, `_2`, …), used in logs and cursors. */
  index: number;
  /** Where success/error notifications for this account go. */
  email?: string;
}
