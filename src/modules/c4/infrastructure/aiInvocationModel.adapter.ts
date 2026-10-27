import type { AIInvocationService } from '../../ai';
import type { C4ModelCall, C4ModelGateway } from '../application/interfaces/c4Sketch.interface';

/**
 * C4 model calls through the AI module's routes (direct chain, retries, OpenRouter fallback) but with the
 * C4 system prompt and the knowledge the sketcher retrieved itself, instead of the chat persona + per-call RAG.
 */
export class AIInvocationModelAdapter implements C4ModelGateway {
  constructor(private readonly invocation: AIInvocationService) {}

  async ask(call: C4ModelCall): Promise<string> {
    const content = { textContent: call.text, imageBuffers: call.images };
    const answer = await this.invocation.answerPrepared(
      { provider: call.provider, model: call.model, content, label: call.label },
      { systemPrompt: call.systemPrompt, content, contexts: [] },
    );
    return answer.text;
  }
}
