import type { StateManager } from '../../../shared/state/processingStateStore';
import type { Answerer } from '../../agent/domain';
import type { ModelCatalog } from '../../ai';
import type { ConversationPollerDeps } from '../application/interfaces/conversationPoller.interface';

export interface ConversationModuleDeps {
  catalog: ModelCatalog;
  state: StateManager;
  answers: Answerer;
  /** CANVAS_DEADLINE_MS: AI chain budget per request (absent = CHAT_DEADLINE_MS). */
  deadlineMs?: number;
  /** Test hooks: fake Canvas client, clock. */
  overrides?: Partial<ConversationPollerDeps>;
}
