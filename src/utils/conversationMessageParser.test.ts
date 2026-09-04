import { describe, it, expect } from 'vitest';
import {
  REQUEST_MARKER,
  buildReply,
  buildSettingMessageBody,
  isReplyMessage,
  isRequestMessage,
  parseReplyMessage,
  parseRequest,
  parseSettingMessageValue,
  ACTIVE_CONVERSATION_ID_SETTING_KEY,
} from './conversationMessageParser';

describe('conversationMessageParser — mirror of extension/lib/messageFormat.js', () => {
  it('parses a standard request with provider + model + question', () => {
    const body = [REQUEST_MARKER, 'provider: gemini', 'model: gemini-2.5-flash', '', 'What is a mutex?'].join('\n');
    const parsed = parseRequest(body);
    expect(parsed.valid).toBe(true);
    expect(parsed.provider).toBe('gemini');
    expect(parsed.model).toBe('gemini-2.5-flash');
    expect(parsed.question).toBe('What is a mutex?');
  });

  it('parses a request without model (backend resolves default)', () => {
    const body = [REQUEST_MARKER, 'provider: claude', '', 'Hello'].join('\n');
    const parsed = parseRequest(body);
    expect(parsed.valid).toBe(true);
    expect(parsed.model).toBeUndefined();
    expect(parsed.question).toBe('Hello');
  });

  it('rejects cloudflare provider explicitly (no backend adapter)', () => {
    const body = [REQUEST_MARKER, 'provider: cloudflare', 'model: xai/grok-4.3', '', 'Hi'].join('\n');
    const parsed = parseRequest(body);
    expect(parsed.valid).toBe(false);
    expect(parsed.error).toContain('cloudflare');
  });

  it('rejects missing provider and non-request bodies', () => {
    expect(parseRequest([REQUEST_MARKER, '', 'Hi'].join('\n')).valid).toBe(false);
    expect(parseRequest('just some text').valid).toBe(false);
    expect(parseRequest(undefined).valid).toBe(false);
  });

  it('builds a reply the extension deriveRequestStatuses can match', () => {
    const body = buildReply({ requestId: 456, status: 'done', provider: 'gemini', model: 'gemini-2.5-flash', content: '# Answer' });
    expect(isReplyMessage(body)).toBe(true);
    expect(isRequestMessage(body)).toBe(false);
    const parsed = parseReplyMessage(body);
    expect(parsed?.requestId).toBe(456);
    expect(parsed?.status).toBe('done');
    expect(parsed?.content).toBe('# Answer');
  });

  it('parseReplyMessage returns null requestId when absent (legacy FIFO)', () => {
    const body = ['[CFH:REPLY]', 'status: done', '', 'Answer'].join('\n');
    expect(parseReplyMessage(body)?.requestId).toBeNull();
  });

  it('round-trips settings values for active_conversation_id', () => {
    const body = buildSettingMessageBody(ACTIVE_CONVERSATION_ID_SETTING_KEY, 12345);
    expect(parseSettingMessageValue(body, ACTIVE_CONVERSATION_ID_SETTING_KEY)).toBe('12345');
    expect(parseSettingMessageValue('[CFH:SETTING:system_prompt] abc', ACTIVE_CONVERSATION_ID_SETTING_KEY)).toBeNull();
    expect(parseSettingMessageValue(undefined, ACTIVE_CONVERSATION_ID_SETTING_KEY)).toBeNull();
  });
});
