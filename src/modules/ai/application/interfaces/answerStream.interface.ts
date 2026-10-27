import type { TextDeltaListener } from '../../domain/interfaces/aiProvider.port';

export interface StreamRelay {
  onDelta: TextDeltaListener;
  /** Called before every adapter attempt. */
  beforeAttempt(): void;
}
