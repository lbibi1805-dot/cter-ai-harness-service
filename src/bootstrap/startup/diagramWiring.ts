import { AiDiagramRepairer, type DiagramRepairer, type DiagramValidator } from '../../modules/agent';
import type { AIProvider, AiModule } from '../../modules/ai';
import { C4RenderService, PlantUmlRendererAdapter } from '../../modules/c4';
import type { AppConfig } from '../interfaces/appConfig.interface';

export interface DiagramWiring {
  /** Shared with `/api/c4/render` (one RAM cache). */
  render: C4RenderService;
  validator: DiagramValidator;
  repairer: DiagramRepairer | null;
}

/**
 * 12/11 plan 03: one PlantUML render service (C4_PLANTUML_SERVER_URL, RAM cache by hash) for the
 * `validate_diagram` agent tool, the post-answer guard and `POST /api/c4/render`. Repairs use the aux model
 * (AUX_PROVIDER / AUX_MODEL) with `prompts/policies/diagram-syntax.md` as system prompt.
 */
export function buildDiagramWiring(config: AppConfig, ai: AiModule, isProviderConfigured: (provider: AIProvider) => boolean): DiagramWiring {
  // The guard also serves the Canvas poller, which runs without CHAT_API_TOKEN: the render service is always on here;
  // the /api/c4 router still rejects requests without the token.
  const render = new C4RenderService(true, new PlantUmlRendererAdapter(config.c4.plantUmlServerUrl));
  const validator: DiagramValidator = {
    validate: async (source) => {
      const result = await render.render(source);
      return result.syntaxError ? { ok: false, error: result.syntaxError, line: result.errorLine } : { ok: true };
    },
  };
  const aux = config.context.aux;
  const repairer = config.prompts.diagramSyntax && isProviderConfigured(aux.provider)
    ? new AiDiagramRepairer(ai.invocation, aux.provider, aux.model, config.prompts.diagramSyntax)
    : null;
  return { render, validator, repairer };
}
