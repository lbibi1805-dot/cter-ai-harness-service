import type { CanvasAccountConfig } from '../../../../shared/canvas/interfaces/canvasAccount.interface';
import { maskEmail } from '../../domain/emailMask';
import { MaskedAccount } from '../interfaces/ops.interface';

export function maskedAccount(account: CanvasAccountConfig): MaskedAccount {
  return { index: account.index, email: account.email ? maskEmail(account.email) : null };
}
