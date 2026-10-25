import type { AnswerMode } from '../../../agent/domain/enums/agent.enums';
import { ConversationMessage } from './conversationMessage.interface';

export interface PendingConversationRequest {
  message: ConversationMessage;
  provider: string;
  model?: string;
  question: string;
  valid: boolean;
  invalidReason?: string;
  mode: AnswerMode;
}

export interface ConversationSettings {
  activeConversationId: number | null;
  sawSystemPrompt: boolean;
}
