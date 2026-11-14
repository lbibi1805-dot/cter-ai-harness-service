import { AiDiagramRepairer, type DiagramGuardStats, type DiagramRepairer, type DiagramValidator } from '../../modules/agent';
import type { AIProvider, AiModule } from '../../modules/ai';
import { C4RenderService, DEFAULT_DIAGRAM_CONNECTIVITY_CHECK, type C4ConnectivityStats, lintPlantUmlConnectivity, PlantUmlRendererAdapter } from '../../modules/c4';
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
  // 12/11 plan 04 §4.3: the same check also lints connectivity (0 tokens), unless DIAGRAM_CONNECTIVITY_CHECK=false.
  const lint = config.diagramGuard?.connectivityCheck ?? DEFAULT_DIAGRAM_CONNECTIVITY_CHECK;
  const validator: DiagramValidator = {
    validate: async (source) => {
      const result = await render.render(source);
      const connectivity = lint ? lintPlantUmlConnectivity(source) : null;
      const extra = connectivity && (connectivity.errors.length || connectivity.warnings.length) ? { connectivity } : {};
      return result.syntaxError ? { ok: false, error: result.syntaxError, line: result.errorLine, ...extra } : { ok: true, ...extra };
    },
  };
  const aux = config.context.aux;
  const repairer = config.prompts.diagramSyntax && isProviderConfigured(aux.provider)
    ? new AiDiagramRepairer(ai.invocation, aux.provider, aux.model, config.prompts.diagramSyntax)
    : null;
  return { render, validator, repairer };
}

/**
 * `GET /api/metrics/latency` → `diagramGuard`: the chat guard's counters plus the /c4 connectivity counters
 * (orphanFound, orphanRepaired, connectivityErrors; RAM only, 0 DB queries). Null when neither runs.
 */
export function diagramGuardMetrics(guard: DiagramGuardStats | null, c4: C4ConnectivityStats | null): DiagramGuardStats | null {
  if (!guard && !c4) return null;
  const base: DiagramGuardStats = guard ?? { answers: 0, blocks: 0, repairs: 0, repairFailed: 0, skipped: 0, orphanFound: 0, orphanRepaired: 0, connectivityErrors: 0 };
  if (!c4) return base;
  return {
    ...base,
    orphanFound: base.orphanFound + c4.orphanFound,
    orphanRepaired: base.orphanRepaired + c4.orphanRepaired,
    connectivityErrors: base.connectivityErrors + c4.connectivityErrors,
  };
}
