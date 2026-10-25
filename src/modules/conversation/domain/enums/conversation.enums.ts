/** `status:` header of a [CFH:REPLY]; the extension renders each differently. */
export enum ConversationReplyStatus {
  DONE = 'done',
  FAILED = 'failed',
  INVALID_FORMAT = 'invalid-format',
  PENDING = 'pending',
}

/** Keys of `[CFH:SETTING:<key>] <value>` messages in the settings conversation. */
export enum ConversationSettingKey {
  ACTIVE_CONVERSATION_ID = 'active_conversation_id',
  SYSTEM_PROMPT = 'system_prompt',
}

/** Header names of the request/reply protocol (lower-cased when parsed). */
export enum ProtocolHeader {
  PROVIDER = 'provider',
  MODEL = 'model',
  MODE = 'mode',
  REQUEST_ID = 'request_id',
  STATUS = 'status',
}
