import { withTimeout } from '../../../shared/resilience';
import type { AIInvocationService, AIProvider } from '../../ai';
import type { AuxCall, AuxModel } from '../domain/interfaces/auxModel.port';

/** The aux model through the AI module's routes (direct key first, OpenRouter fallback), with its own prompt and no RAG. */
export class AiInvocationAuxModel implements AuxModel {
  readonly name: string;

  constructor(
    private readonly invocation: AIInvocationService,
    private readonly provider: AIProvider,
    private readonly model: string,
  ) {
    this.name = `${provider}/${model}`;
  }

  async complete(call: AuxCall): Promise<string> {
    const content = { textContent: call.text, imageBuffers: call.images ?? [] };
    const answer = await withTimeout(
      this.invocation.answerPrepared(
        { provider: this.provider, model: this.model, content, label: call.label },
        { systemPrompt: call.system, content, contexts: [] },
      ),
      call.timeoutMs,
      call.label,
    );
    return answer.text;
  }
}
