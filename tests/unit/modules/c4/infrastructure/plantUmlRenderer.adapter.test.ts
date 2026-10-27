import { afterEach, describe, expect, it } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { decodePlantUml, encodePlantUml, PlantUmlRendererAdapter } from '../../../../../src/modules/c4';

const SOURCE = '@startuml\nBob -> Alice : xin chào "quoted"\n@enduml';

let server: http.Server | undefined;

/** Fake PlantUML server: each request is answered by the next scripted handler. */
async function fakePlantUml(handlers: Array<(req: http.IncomingMessage, res: http.ServerResponse) => void>): Promise<{ url: string; paths: string[] }> {
  const paths: string[] = [];
  server = http.createServer((req, res) => {
    paths.push(req.url ?? '');
    (handlers.shift() ?? ((_q, r) => { r.writeHead(500); r.end(); }))(req, res);
  });
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/plantuml/`, paths };
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('PlantUML encoding', () => {
  it('uses the 6-bit PlantUML alphabet and round-trips UTF-8', () => {
    const encoded = encodePlantUml(SOURCE);
    expect(encoded).toMatch(/^[0-9A-Za-z_-]+$/);
    expect(encoded.length % 4).toBe(0);
    expect(decodePlantUml(encoded)).toBe(SOURCE);
  });
});

describe('PlantUmlRendererAdapter', () => {
  it('GETs /png/{encoded} and returns the PNG bytes', async () => {
    const fake = await fakePlantUml([(_req, res) => { res.writeHead(200, { 'content-type': 'image/png' }); res.end('PNGDATA'); }]);
    const result = await new PlantUmlRendererAdapter(fake.url).render(SOURCE);
    expect(result.png?.toString()).toBe('PNGDATA');
    expect(fake.paths[0]).toBe(`/plantuml/png/${encodePlantUml(SOURCE)}`);
  });

  it('returns the syntax error from the X-PlantUML-Diagram-Error headers', async () => {
    const fake = await fakePlantUml([(_req, res) => {
      res.writeHead(400, { 'x-plantuml-diagram-error': 'Syntax Error?', 'x-plantuml-diagram-error-line': '3' });
      res.end('error image');
    }]);
    expect(await new PlantUmlRendererAdapter(fake.url).render(SOURCE)).toEqual({ syntaxError: 'Syntax Error?', errorLine: 3 });
  });

  it('retries a 5xx and then succeeds', async () => {
    const fake = await fakePlantUml([
      (_req, res) => { res.writeHead(503); res.end(); },
      (_req, res) => { res.writeHead(200); res.end('OK'); },
    ]);
    const result = await new PlantUmlRendererAdapter(fake.url, async () => undefined).render(SOURCE);
    expect(result.png?.toString()).toBe('OK');
    expect(fake.paths).toHaveLength(2);
  });

  it('throws an upstream error after the retries are used up', async () => {
    const fake = await fakePlantUml([]);
    await expect(new PlantUmlRendererAdapter(fake.url, async () => undefined).render(SOURCE)).rejects.toThrow(/PlantUML server: 500/);
    expect(fake.paths).toHaveLength(3);
  });
});
