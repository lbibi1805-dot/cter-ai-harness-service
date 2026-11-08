import type { TextDeltaListener } from '../../domain/interfaces/aiProvider.port';

/** The stream as seen by one adapter attempt. */
export interface AttemptSink {
  onDelta: TextDeltaListener;
  /** True once this attempt sent text to the client. */
  emitted(): boolean;
  /** Drops any later chunk of this attempt. */
  close(): void;
}

export interface StreamRelay {
  /** Called before every adapter attempt; resets the client when an earlier attempt sent text. */
  beginAttempt(): AttemptSink;
  /** Epoch ms of the first text sent to the client, if any. */
  firstDeltaAt(): number | undefined;
}
