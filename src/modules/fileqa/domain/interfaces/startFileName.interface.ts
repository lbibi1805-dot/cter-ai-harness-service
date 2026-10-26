import { AnswerMode } from '../../../agent/domain/enums/agent.enums';
import { type AIProvider } from '../../../ai/domain/enums/ai.enums';

export interface ParsedFileName {
  originalName: string;
  provider: AIProvider;
  /** As written in the file name; resolved (and validated) by the ModelCatalog. */
  model?: string;
  extension: string;
  doneFileName: string;
  mode: AnswerMode;
}
