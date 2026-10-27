import type { TextDeltaListener } from '../../domain/interfaces/aiProvider.port';
import type { AnswerStream } from '../interfaces/aiInvocation.interface';
import type { StreamRelay } from '../interfaces/answerStream.interface';

/**
 * Connects one request's stream to the adapter attempts: every attempt streams into it, and an attempt that
 * starts after text was already sent (retry, next model, OpenRouter) first resets it.
 */
export function createStreamRelay(stream: AnswerStream): StreamRelay {
  let sent = false;
  const onDelta: TextDeltaListener = (text) => {
    if (!text) return;
    sent = true;
    stream.delta(text);
  };
  return {
    onDelta,
    beforeAttempt: () => {
      if (!sent) return;
      sent = false;
      stream.reset();
    },
  };
}
