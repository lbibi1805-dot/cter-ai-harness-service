import type { KeyValidationResult } from '../../../ai';
import { StartOutcome } from '../../domain';

export type KeyValidator = () => Promise<KeyValidationResult[]>;

export interface StartResult {
  status: StartOutcome;
  /** Present only when polling was actually started (credentials are checked first). */
  validation?: KeyValidationResult[];
}
