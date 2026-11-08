import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { ModelCatalog, type AIInvocationService } from '../../../../../src/modules/ai';
import { createC4Module, MAX_RENDER_SOURCE_CHARS, type C4Config } from '../../../../../src/modules/c4';
import type { DiagramRender } from '../../../../../src/modules/c4/domain';
import { RenderCache } from '../../../../../src/modules/c4/application/helpers/renderCache.helper';
import { UpstreamError } from '../../../../../src/shared/errors';
import type { Router } from '../../../../../src/shared/http/router';
import { buildTestAiConfig, buildTestConfig } from '../../../../support/configFixture';

const TOKEN = 'chat-secret';
const CONFIG: C4Config = buildTestConfig().c4;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const SOURCE = '@startuml\n!include <C4/C4_Container>\nPerson(u, "User")\n@enduml';

function build(render: (puml: string) => Promise<DiagramRender>, enabled = true) {
  const renderer = { render: vi.fn(render) };
  const module = createC4Module({ ...CONFIG, chatApiToken: enabled ? TOKEN : undefined }, {
    invocation: {} as AIInvocationService,
    catalog: new ModelCatalog(buildTestAiConfig()),
    currentRetriever: () => null,
    model: { ask: vi.fn() },
    renderer,
  });
  return { router: module.router, renderer };
}

async function call(router: Router, body: unknown, auth = `Bearer ${TOKEN}`) {
  let status = 0;
  let headers: Record<string, string> = {};
  let payload: Buffer | string = '';
  const res = {
    headersSent: false,
    writeHead: vi.fn((code: number, h?: Record<string, string>) => { status = code; headers = h ?? {}; }),
    end: vi.fn((chunk: Buffer | string) => { payload = chunk; }),
  } as unknown as ServerResponse;
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), { method: 'POST', url: '/api/c4/render', headers: { authorization: auth } }) as unknown as IncomingMessage;
  await router.dispatch(req, res, new URL('/api/c4/render', 'http://localhost'));
  const json = typeof payload === 'string' && payload ? JSON.parse(payload) : undefined;
  return { status, headers, payload, json };
}

describe('POST /api/c4/render', () => {
  it('returns the PNG bytes, then serves the same (normalized) source from the RAM cache', async () => {
    const { router, renderer } = build(async () => ({ png: PNG }));
    const first = await call(router, { source: SOURCE, format: 'png' });
    expect(first.status).toBe(200);
    expect(first.headers['Content-Type']).toBe('image/png');
    expect(first.headers['X-Render-Cache']).toBe('miss');
    expect(Buffer.compare(first.payload as unknown as Buffer, PNG)).toBe(0);
    const second = await call(router, { source: `${SOURCE.replace(/\n/g, '\r\n')}\n` });
    expect(second.status).toBe(200);
    expect(second.headers['X-Render-Cache']).toBe('hit');
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('wraps a source without @startuml/@enduml', async () => {
    const { router, renderer } = build(async () => ({ png: PNG }));
    expect((await call(router, { source: 'Person(u, "User")' })).status).toBe(200);
    expect(renderer.render).toHaveBeenCalledWith('@startuml\nPerson(u, "User")\n@enduml');
  });

  it('maps a PlantUML syntax error to 422 { error, syntaxError, line } (cached as well)', async () => {
    const { router, renderer } = build(async () => ({ syntaxError: 'Syntax Error?', errorLine: 3 }));
    const res = await call(router, { source: SOURCE });
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: 'PlantUML syntax error', syntaxError: 'Syntax Error?', line: 3 });
    expect((await call(router, { source: SOURCE })).status).toBe(422);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('answers 502 when the renderer fails, and does not cache the failure', async () => {
    let calls = 0;
    const { router } = build(async () => {
      calls++;
      if (calls === 1) throw new UpstreamError('PlantUML server: 500');
      if (calls === 2) throw new Error('socket hang up');
      return { png: PNG };
    });
    expect((await call(router, { source: SOURCE })).status).toBe(502);
    expect((await call(router, { source: SOURCE })).status).toBe(502);
    expect((await call(router, { source: SOURCE })).status).toBe(200);
  });

  it('needs the chat token; 503 without one', async () => {
    const { router, renderer } = build(async () => ({ png: PNG }));
    expect((await call(router, { source: SOURCE }, 'Bearer wrong')).status).toBe(401);
    expect((await call(build(async () => ({ png: PNG }), false).router, { source: SOURCE }, '')).status).toBe(503);
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('rejects bad bodies (400) and sources over the size limit (413)', async () => {
    const { router, renderer } = build(async () => ({ png: PNG }));
    expect((await call(router, {})).status).toBe(400);
    expect((await call(router, { source: '   ' })).status).toBe(400);
    expect((await call(router, { source: SOURCE, format: 'svg' })).status).toBe(400);
    expect((await call(router, { source: 'x'.repeat(MAX_RENDER_SOURCE_CHARS + 1) })).status).toBe(413);
    expect((await call(router, { source: '@startuml\n@enduml' })).status).toBe(400);
    expect(renderer.render).not.toHaveBeenCalled();
  });
});

describe('RenderCache', () => {
  it('evicts the least recently used entry by count and by PNG bytes', () => {
    const cache = new RenderCache(2, 10);
    cache.set('a', { png: Buffer.alloc(4) });
    cache.set('b', { png: Buffer.alloc(4) });
    cache.get('a');
    cache.set('c', { png: Buffer.alloc(4) });
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeDefined();
    cache.set('d', { png: Buffer.alloc(8) });
    expect(cache.size).toBe(1);
    cache.set('huge', { png: Buffer.alloc(11) });
    expect(cache.get('huge')).toBeUndefined();
  });
});
