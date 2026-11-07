import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { createConversationStoreModule, InMemoryConversationStore, MessageKind, MessageRole, ArtifactKind, type ConversationStoreModule } from '../../../../src/modules/conversation-store';
import { StorageProvider } from '../../../../src/shared/database/enums/database.enums';
import { FakeObjectStorage } from '../../../support/countingAdapters';

const CHAT = 'chat-token';
const ADMIN = 'admin-token';

async function call(mod: ConversationStoreModule, method: string, url: string, token = CHAT) {
  let status = 0;
  let body: Buffer | string = '';
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    writeHead: (code: number, h?: Record<string, string>) => { status = code; Object.assign(headers, h); },
    end: (chunk?: Buffer | string) => { body = chunk ?? ''; },
  } as unknown as ServerResponse;
  const req = { method, url, headers: { authorization: `Bearer ${token}` } } as unknown as IncomingMessage;
  await mod.router.dispatch(req, res, new URL(url, 'http://localhost'));
  const text = Buffer.isBuffer(body) ? body.toString() : body;
  return { status, headers, body: text && headers['Content-Type']?.includes('json') !== false && text.startsWith('{') ? JSON.parse(text) : text };
}

describe('/api/conversations', () => {
  let mod: ConversationStoreModule;
  let store: InMemoryConversationStore;
  let id: string;
  let artifactId: string;

  beforeEach(async () => {
    store = new InMemoryConversationStore();
    const storage = new FakeObjectStorage();
    mod = createConversationStoreModule(
      { enabled: true, purgeDays: 30, database: { provider: StorageProvider.FILE }, chatApiToken: CHAT, adminToken: ADMIN },
      { storage, store },
    );
    id = randomUUID();
    artifactId = randomUUID();
    const ref = await mod.service!.putArtifactObject(id, artifactId, Buffer.from('PNGDATA'), 'image/png');
    const userId = randomUUID();
    await store.recordTurn({
      conversationId: id, title: 'Đề bài',
      messages: [{ id: userId, role: MessageRole.USER, kind: MessageKind.CHAT, text: 'q' }, { id: randomUUID(), role: MessageRole.ASSISTANT, kind: MessageKind.CHAT, text: 'a' }],
      artifacts: [{ id: artifactId, messageId: userId, kind: ArtifactKind.USER_IMAGE, mime: 'image/png', ...ref }],
    });
  });

  it('GET returns messages and artifacts with a short-lived URL; list shows it', async () => {
    const got = await call(mod, 'GET', `/api/conversations/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.messages.map((m: { text: string }) => m.text)).toEqual(['q', 'a']);
    expect(got.body.artifacts[0].url).toContain(`conversations/${id}/${artifactId}.png`);
    expect((await call(mod, 'GET', '/api/conversations')).body.conversations.map((c: { id: string }) => c.id)).toEqual([id]);
  });

  it('artifact bytes are downloadable through the API (dev without presigned URLs)', async () => {
    const got = await call(mod, 'GET', `/api/conversations/${id}/artifacts/${artifactId}`);
    expect(got.status).toBe(200);
    expect(got.headers['Content-Type']).toBe('image/png');
    expect(got.body).toBe('PNGDATA');
  });

  it('soft delete → 204 twice, then 404; trash lists it; restore brings it back', async () => {
    expect((await call(mod, 'DELETE', `/api/conversations/${id}`)).status).toBe(204);
    expect((await call(mod, 'DELETE', `/api/conversations/${id}`)).status).toBe(204);
    expect((await call(mod, 'GET', `/api/conversations/${id}`)).status).toBe(404);
    expect((await call(mod, 'GET', '/api/conversations?deleted=true')).body.conversations[0].id).toBe(id);
    expect((await call(mod, 'POST', `/api/conversations/${id}/restore`)).status).toBe(200);
    expect((await call(mod, 'GET', `/api/conversations/${id}/artifacts/${artifactId}`)).body).toBe('PNGDATA');
  });

  it('hard delete needs the admin token; the chat token alone gets 401', async () => {
    expect((await call(mod, 'DELETE', `/api/conversations/${id}?hard=true`)).status).toBe(401);
    expect((await call(mod, 'DELETE', `/api/conversations/${id}?hard=true`, ADMIN)).status).toBe(204);
    expect((await call(mod, 'POST', `/api/conversations/${id}/restore`)).status).toBe(404);
  });

  it('the monitoring UI (ADMIN_TOKEN) can list, read, soft delete and restore', async () => {
    expect((await call(mod, 'GET', '/api/conversations', ADMIN)).status).toBe(200);
    expect((await call(mod, 'GET', `/api/conversations/${id}`, ADMIN)).status).toBe(200);
    expect((await call(mod, 'DELETE', `/api/conversations/${id}`, ADMIN)).status).toBe(204);
    expect((await call(mod, 'POST', `/api/conversations/${id}/restore`, ADMIN)).status).toBe(200);
  });

  it('wrong token → 401; bad id → 400; unknown id → 404', async () => {
    expect((await call(mod, 'GET', `/api/conversations/${id}`, 'nope')).status).toBe(401);
    expect((await call(mod, 'DELETE', `/api/conversations/${id}`, 'nope')).status).toBe(401);
    expect((await call(mod, 'GET', '/api/conversations/abc')).status).toBe(400);
    expect((await call(mod, 'GET', `/api/conversations/${randomUUID()}`)).status).toBe(404);
  });

  it('feature flag off → 503', async () => {
    const off = createConversationStoreModule({ enabled: false, purgeDays: 30, database: { provider: StorageProvider.FILE }, chatApiToken: CHAT }, { storage: new FakeObjectStorage() });
    expect((await call(off, 'GET', '/api/conversations')).status).toBe(503);
  });
});
