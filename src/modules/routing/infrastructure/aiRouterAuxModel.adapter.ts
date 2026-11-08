import { withTimeout } from '../../../shared/resilience';
import type { AIInvocationService, AIProvider } from '../../ai';
import { ROUTER_AUX_PURPOSE } from '../application/constants/auxRouter.constants';
import type { RouterAuxCall, RouterAuxModel } from '../application/interfaces/auxRouter.interface';

/** The aux model through the AI module's routes, with a tiny output cap and a hard deadline. */
export class AiRouterAuxModel implements RouterAuxModel {
  readonly name: string;

  constructor(
    private readonly invocation: AIInvocationService,
    private readonly provider: AIProvider,
    private readonly model: string,
    private readonly now: () => number = Date.now,
  ) {
    this.name = `${provider}/${model}`;
  }

  async complete(call: RouterAuxCall): Promise<string> {
    const content = { textContent: call.text, imageBuffers: [] };
    const answer = await withTimeout(
      this.invocation.answerPrepared(
        {
          provider: this.provider, model: this.model, content, label: call.label, purpose: ROUTER_AUX_PURPOSE,
          deadlineAt: this.now() + call.timeoutMs, maxOutputTokens: call.maxOutputTokens,
        },
        { systemPrompt: call.system, content, contexts: [] },
      ),
      call.timeoutMs,
      call.label,
    );
    return answer.text;
  }
}
