import type { TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { AnswerStream } from '../interfaces/aiInvocation.interface';
import type { AttemptSink, StreamRelay } from '../interfaces/answerStream.interface';

/**
 * Connects one request's stream to the adapter attempts: every attempt streams into it, and an attempt that
 * starts after text was already sent (next model, OpenRouter) first resets it. A closed attempt (timed out,
 * aborted) can no longer write: late chunks of an abandoned request never mix into the next answer.
 */
export function createStreamRelay(stream: AnswerStream, now: () => number = Date.now): StreamRelay {
  let sent = false;
  let firstDeltaAt: number | undefined;
  return {
    beginAttempt(): AttemptSink {
      if (sent) {
        sent = false;
        stream.reset();
      }
      let open = true;
      let emitted = false;
      const onDelta: TextDeltaListener = (text) => {
        if (!open || !text) return;
        emitted = true;
        sent = true;
        firstDeltaAt ??= now();
        stream.delta(text);
      };
      return { onDelta, emitted: () => emitted, close: () => { open = false; } };
    },
    firstDeltaAt: () => firstDeltaAt,
  };
}
