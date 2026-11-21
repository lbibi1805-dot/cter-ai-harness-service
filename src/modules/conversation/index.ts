import { ConversationPoller } from './application/conversationPoller.service';
import { ConversationClient } from './infrastructure/canvasConversationClient.adapter';
import type { ConversationModuleDeps } from './interfaces/conversationModule.interface';

export type { ConversationModuleDeps } from './interfaces/conversationModule.interface';

/** The extension-chat poll job with the production Canvas client. */
export function createConversationPoller(deps: ConversationModuleDeps): ConversationPoller {
  return new ConversationPoller(deps.catalog, deps.state, deps.answers, {
    createClient: (account) => new ConversationClient(account.url, account.apiKey),
    ...(deps.deadlineMs !== undefined ? { deadlineMs: deps.deadlineMs } : {}),
    ...deps.overrides,
  });
}

export { ConversationPoller } from './application/conversationPoller.service';
export * from './domain';
export { ConversationClient } from './infrastructure/canvasConversationClient.adapter';
export type { ConversationPollerDeps } from './application/interfaces/conversationPoller.interface';
