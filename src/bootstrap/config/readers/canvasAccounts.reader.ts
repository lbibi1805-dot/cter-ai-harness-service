import type { CanvasAccountConfig } from '../../../shared/canvas/interfaces/canvasAccount.interface';
import { readOptionalString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';

/** CANVAS_URL_1/CANVAS_KEY_1, CANVAS_URL_2/…, stopping at the first gap. At least one is required. */
export function readCanvasAccounts(): CanvasAccountConfig[] {
  const accounts: CanvasAccountConfig[] = [];
  for (let index = 1; ; index++) {
    const url = readOptionalString(`CANVAS_URL_${index}`);
    const apiKey = readOptionalString(`CANVAS_KEY_${index}`);
    if (!url || !apiKey) break;
    accounts.push({ url, apiKey, index, email: readOptionalString(`CANVAS_EMAIL_${index}`) });
  }
  if (accounts.length === 0) throw new ConfigurationError('No Canvas accounts configured. Set CANVAS_URL_1 and CANVAS_KEY_1 in .env');
  return accounts;
}
