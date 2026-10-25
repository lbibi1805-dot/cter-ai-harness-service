import { AnswerMode } from '../../../agent/domain/enums/agent.enums';
import { type AIProvider } from '../../../ai/domain/enums/ai.enums';
import { ConversationReplyStatus } from '../enums/conversation.enums';

export interface ConversationAttachment {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
}

export interface ConversationMessage {
  id: number;
  body: string;
  createdAt: string;
  attachments: ConversationAttachment[];
}

export interface ParsedConversationRequest {
  /** The raw provider text; a servable AIProvider only when `valid`. */
  provider: AIProvider | string;
  model?: string;
  question: string;
  valid: boolean;
  error?: string;
  mode: AnswerMode;
}

export interface ConversationReply {
  requestId: number;
  status: ConversationReplyStatus;
  provider: string;
  model: string;
  content: string;
  /** Only written for agent answers, so legacy clients see unchanged replies. */
  mode?: AnswerMode;
}

export interface ParsedReply {
  requestId: number | null;
  status: string;
  provider?: string;
  model?: string;
  content: string;
}

export interface HeaderBlock {
  headers: Record<string, string>;
  content: string;
}
