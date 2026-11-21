import { logger } from '../../shared/logging/logger';
import { AuxRouterResolver } from './application/auxRouter.service';
import { IntentRouter } from './application/intentRouter.service';
import { AiRouterAuxModel } from './infrastructure/aiRouterAuxModel.adapter';
import type { RoutingConfig, RoutingDeps, RoutingModule } from './interfaces/routingModule.interface';

export type { RoutingConfig, RoutingDeps, RoutingModule } from './interfaces/routingModule.interface';

/** Intent Router + the combined aux call shared with the artifact resolver (notes 05 §2, 17 §3.3). */
export function createRoutingModule(config: RoutingConfig, deps: RoutingDeps): RoutingModule {
  const model = deps.auxModel !== undefined
    ? deps.auxModel
    : deps.isProviderConfigured(config.aux.provider) ? new AiRouterAuxModel(deps.invocation, config.aux.provider, config.aux.model) : null;
  logger.info(`[routing] intent router: rules${model ? ` + aux ${model.name} (timeout ${config.timeoutMs}ms)` : ' only (aux model not configured)'}`);
  return {
    router: new IntentRouter(model, { timeoutMs: config.timeoutMs, skills: config.skills ?? null }),
    auxResolver: model ? new AuxRouterResolver(model, config.timeoutMs) : null,
    auxModel: model,
  };
}

export { IntentRouter } from './application/intentRouter.service';
export { AuxRouterSession, AuxRouterResolver, parseAuxRouteReply } from './application/auxRouter.service';
export { classifyIntent, fallbackIntent, intentCues, commandText } from './domain/intentRules';
export { RequestIntent, IntentSource, ClientIntent } from './domain/enums/routing.enums';
export { CLIENT_INTENTS, GENERATING_INTENTS, REVIEWING_INTENTS } from './domain/constants/routing.constants';
export type { IntentDecision, IntentInput, IntentCues } from './domain/interfaces/routing.interface';
export type { AuxEssayBlock, AuxRouteReply, RouterAuxCall, RouterAuxModel, RouterSkillSource } from './application/interfaces/auxRouter.interface';
export {
  ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS,
  ROUTER_AUX_MAX_OUTPUT_TOKENS,
  ROUTER_ESSAY_INSTRUCTIONS,
  ROUTER_ESSAY_SKILL_ID,
} from './application/constants/auxRouter.constants';
