import type { StateManager } from '../../../shared/state/processingStateStore';
import type { Answerer } from '../../agent/domain';
import type { ModelCatalog } from '../../ai';
import type { Notifier } from '../../notification';
import type { FileQaJobDeps } from '../application/interfaces/fileQaJob.interface';

export interface FileQaModuleDeps {
  catalog: ModelCatalog;
  state: StateManager;
  notifier: Notifier;
  answers: Answerer;
  /** CANVAS_DEADLINE_MS: AI chain budget per file (absent = CHAT_DEADLINE_MS). */
  deadlineMs?: number;
  /** Test hooks: fake Canvas, extractor or renderer. */
  overrides?: Partial<FileQaJobDeps>;
}
