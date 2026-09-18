import * as http from 'http';

/**
 * `/openapi.json` + `/docs` (Swagger UI) — moved verbatim from `src/api/server.ts`
 * (Phase 1, mục 3 / mục 6 Phase 1 step 1). Returns `true` if the request was handled.
 */
export async function handleDocsRouter(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/openapi.json') {
    try {
      const fs = await import('fs'); const p = await import('path');
      const specPath = p.resolve(process.cwd(), 'docs/openapi.json');
      const spec = fs.readFileSync(specPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(spec);
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'spec not found' }));
    }
    return true;
  }
  if (pathname === '/docs' || pathname === '/docs/') {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vault API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui',presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset]});</script></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return true;
  }
  return false;
}
