import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConversationClient } from './conversationClient';

function jsonResponse(data: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('ConversationClient — mirror of extension/lib/canvasApi.js', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listMessages returns oldest-first with mapped attachments', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({
      messages: [
        { id: 3, body: 'new', created_at: '2026-01-03', attachments: [] },
        { id: 1, body: 'old', created_at: '2026-01-01', attachments: [{ id: 9, filename: 'a.png', url: 'https://x/files/9', 'content-type': 'image/png' }] },
      ],
    }));
    const client = new ConversationClient('https://base', 'tok');
    const messages = await client.listMessages(5);
    expect(messages.map((m) => m.id)).toEqual([1, 3]);
    expect(messages[0].attachments[0]).toMatchObject({ id: '9', filename: 'a.png', contentType: 'image/png' });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/v1/conversations/5?interleave_submissions=0');
  });

  it('listSettingsConversations scopes by self id, filters marker, paginates', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 42 })) // getSelfUserId
      .mockResolvedValueOnce(jsonResponse(
        [{ id: 7, subject: '[CFH:SETTINGS] Canvas Settings', updated_at: '2026-01-02' }, { id: 8, subject: 'other', updated_at: '2026-01-03' }],
        { Link: '<https://base/api/v1/conversations?page=2>; rel="next"' },
      ))
      .mockResolvedValueOnce(jsonResponse(
        [{ id: 9, subject: '[CFH:SETTINGS] old', updated_at: '2026-01-01' }],
      ));
    const client = new ConversationClient('https://base', 'tok');
    const matches = await client.listSettingsConversations('[CFH:SETTINGS]');
    expect(matches.map((m) => m.id)).toEqual([7, 9]); // newest first, non-matching excluded
    expect(fetchMock.mock.calls[1][0]).toContain('filter=user_42');
  });

  it('readSettings reverse-scans past a trailing system_prompt message', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(jsonResponse({
      messages: [
        { id: 3, body: '[CFH:SETTING:system_prompt] abc', created_at: 't3', attachments: [] },
        { id: 2, body: '[CFH:SETTING:active_conversation_id] 777', created_at: 't2', attachments: [] },
        { id: 1, body: 'anything', created_at: 't1', attachments: [] },
      ],
    }));
    const client = new ConversationClient('https://base', 'tok');
    const settings = await client.readSettings(1);
    expect(settings.activeConversationId).toBe(777);
    expect(settings.sawSystemPrompt).toBe(true);
  });

  it('addReply posts form-urlencoded and verifies via GET', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response('{"id":1}', { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ messages: [{ id: 2, body: 'x'.repeat(100), created_at: 't', attachments: [] }] }));
    const client = new ConversationClient('https://base', 'tok');
    await client.addReply(5, 'x'.repeat(100));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/conversations/5/add_message');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('addReply throws on non-OK so the poller can keep the message pending', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response('err', { status: 500 }));
    const client = new ConversationClient('https://base', 'tok');
    await expect(client.addReply(5, 'body')).rejects.toThrow('add_message failed');
  });
});
