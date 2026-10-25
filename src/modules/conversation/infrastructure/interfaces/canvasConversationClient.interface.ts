export interface RawAttachment {
  id?: number | string;
  filename?: string;
  url?: string;
  'content-type'?: string;
  contentType?: string;
}

export interface RawMessage {
  id: number;
  body?: string;
  created_at?: string;
  attachments?: RawAttachment[];
}

export interface RawConversation {
  id: number;
  subject?: string;
  updated_at?: string;
  last_message_at?: string;
}
