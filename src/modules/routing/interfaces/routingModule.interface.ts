import type { AIInvocationService, AIProvider } from '../../ai';
import type { AuxResolver } from '../../context';
import type { IntentRouter } from '../application/intentRouter.service';
import type { RouterAuxModel, RouterSkillSource } from '../application/interfaces/auxRouter.interface';

export interface RoutingConfig {
  /** AUX_PROVIDER / AUX_MODEL. */
  aux: { provider: AIProvider; model: string };
  /** ARTIFACT_RESOLVER_AUX_TIMEOUT_MS. */
  timeoutMs: number;
  /** Prompt registry lookup (`prompts/skills/routing/*.md`); absent = the built-in constants. */
  skills?: RouterSkillSource | null;
}

export interface RoutingDeps {
  invocation: AIInvocationService;
  isProviderConfigured: (provider: AIProvider) => boolean;
  /** Test hook (null = rules only). */
  auxModel?: RouterAuxModel | null;
}

export interface RoutingModule {
  router: IntentRouter;
  /** Step ③ of the chat path's artifact resolver (one combined call per ambiguous question); null = rules only. */
  auxResolver: AuxResolver | null;
  /** The aux model itself (small JSON jobs such as the C4 clarify-reply parser); null = not configured. */
  auxModel: RouterAuxModel | null;
}
