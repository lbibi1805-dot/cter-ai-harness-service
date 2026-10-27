import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { AIProvider, ModelCatalog, type AIInvocationService } from '../../../../../src/modules/ai';
import { createC4Module, type C4Config } from '../../../../../src/modules/c4';
import type { C4ModelCall } from '../../../../../src/modules/c4/application/interfaces/c4Sketch.interface';
import type { Router } from '../../../../../src/shared/http/router';
import { buildTestAiConfig, buildTestConfig } from '../../../../support/configFixture';
import { CONTEXT_SPEC_JSON, REQUIREMENTS } from '../../../../support/c4Fixture';

const TOKEN = 'chat-secret';
const CONFIG: C4Config = buildTestConfig().c4;

function build(enabled = true) {
  const token = enabled ? TOKEN : undefined;
  const ask = vi.fn(async (_call: C4ModelCall) => JSON.stringify({ systemName: 'Cinema', requirements: REQUIREMENTS, diagrams: { context: CONTEXT_SPEC_JSON } }));
  const module = createC4Module({ ...CONFIG, chatApiToken: token }, {
    invocation: {} as AIInvocationService,
    catalog: new ModelCatalog(buildTestAiConfig()),
    currentRetriever: () => null,
    model: { ask },
    renderer: { render: async () => ({ png: Buffer.from('png') }) },
  });
  return { router: module.router, ask };
}

async function call(router: Router, body: unknown, auth = `Bearer ${TOKEN}`) {
  let status = 0;
  let text = '';
  const res = {
    writeHead: vi.fn((code: number) => { status = code; }),
    end: vi.fn((chunk: string) => { text = chunk; }),
  } as unknown as ServerResponse;
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: 'POST', url: '/api/c4', headers: { authorization: auth } }) as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL('/api/c4', 'http://localhost'));
  return { status, body: JSON.parse(text) };
}

describe('POST /api/c4', () => {
  it('sketches the requested levels and returns base64 PNGs', async () => {
    const { router, ask } = build();
    const { status, body } = await call(router, { provider: 'Gemini', description: ' Cinema booking ', levels: ['ctx'], fast: true });
    expect(status).toBe(200);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ provider: AIProvider.GEMINI }));
    expect(body).toMatchObject({ provider: 'gemini', systemName: 'Cinema', deadlineHit: false, knowledgeSources: [] });
    expect(body.levels).toHaveLength(1);
    expect(body.levels[0]).toMatchObject({ level: 'context', ok: true, png: Buffer.from('png').toString('base64'), error: null });
    expect(body.levels[0].puml).toContain('!include <C4/C4_Context>');
  });

  it('rejects bad bodies with 400', async () => {
    const { router, ask } = build();
    expect((await call(router, { provider: 'gemini' })).status).toBe(400);
    expect((await call(router, { provider: 'gemini', description: 'x', levels: ['deployment'] })).status).toBe(400);
    expect((await call(router, { provider: 'nope', description: 'x' })).status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it('needs the chat token and answers 503 without one', async () => {
    expect((await call(build().router, { provider: 'gemini', description: 'x' }, 'Bearer wrong')).status).toBe(401);
    expect((await call(build(false).router, { provider: 'gemini', description: 'x' }, '')).status).toBe(503);
  });
});
