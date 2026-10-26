import type { StateManager } from '../../shared/state/processingStateStore';
import type { Answerer } from '../agent/domain';
import type { ModelCatalog } from '../ai';
import { ConversationPoller } from './application/conversationPoller.service';
import { ConversationClient } from './infrastructure/canvasConversationClient.adapter';
import { ConversationPollerDeps } from './application/interfaces/conversationPoller.interface';

export interface ConversationModuleDeps {
  catalog: ModelCatalog;
  state: StateManager;
  answers: Answerer;
  /** Test hooks: fake Canvas client, clock. */
  overrides?: Partial<ConversationPollerDeps>;
}

/** The extension-chat poll job with the production Canvas client. */
export function createConversationPoller(deps: ConversationModuleDeps): ConversationPoller {
  return new ConversationPoller(deps.catalog, deps.state, deps.answers, {
    createClient: (account) => new ConversationClient(account.url, account.apiKey),
    ...deps.overrides,
  });
}

export { ConversationPoller } from './application/conversationPoller.service';
export * from './domain';
export { ConversationClient } from './infrastructure/canvasConversationClient.adapter';
export type { ConversationPollerDeps } from './application/interfaces/conversationPoller.interface';
