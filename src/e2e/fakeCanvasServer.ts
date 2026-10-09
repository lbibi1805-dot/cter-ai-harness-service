// Minimal Canvas LMS stand-in for end-to-end tests: implements exactly the
// REST endpoints CanvasClient and ConversationClient call, with pagination
// (Link: rel="next"), signed-upload two-step flow, and fault injection.
import * as http from 'http';
import type { AddressInfo } from 'net';

export interface StoredFile {
  id: number;
  name: string;
  updatedAt: string;
  body: Buffer;
}

export interface StoredMessage {
  id: number;
  body: string;
  created_at: string;
}

const MATERIALS_ID = 1;
const INPUT_ID = 2;
const OUTPUT_ID = 3;
export const SETTINGS_CONVERSATION_ID = 10;
export const ACTIVE_CONVERSATION_ID = 20;
const SELF_USER_ID = 7;
/** Forces pagination even with per_page=100 so Link handling is exercised. */
const PAGE_SIZE = 2;

export class FakeCanvasServer {
  readonly input: StoredFile[] = [];
  readonly output: StoredFile[] = [];
  readonly conversation: StoredMessage[] = [];
  readonly requestLog: string[] = [];
  /** Number of upcoming Q-folder listings that should fail with HTTP 500. */
  failInputListings = 0;

  private server = http.createServer((req, res) => void this.route(req, res));
  private nextId = 1000;
  private pendingUploads = new Map<string, string>();
  baseUrl = '';

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  addInputFile(name: string, updatedAt: string, text: string): void {
    this.input.push({ id: this.nextId++, name, updatedAt, body: Buffer.from(text) });
  }

  addConversationRequest(question: string, provider = 'gemini'): number {
    const id = this.nextId++;
    this.conversation.push({ id, body: `[CFH:REQUEST]\nprovider: ${provider}\n\n${question}`, created_at: new Date().toISOString() });
    return id;
  }

  count(pattern: RegExp): number {
    return this.requestLog.filter((line) => pattern.test(line)).length;
  }

  private async route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', this.baseUrl);
    const p = url.pathname;
    this.requestLog.push(`${req.method} ${p}${url.search}`);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };

    if (p === '/api/v1/users/self/folders/by_path/Materials2') return json(200, [{ id: MATERIALS_ID, name: 'Materials2', full_name: 'Materials2', parent_folder_id: null }]);
    if (p === `/api/v1/folders/${MATERIALS_ID}/folders`) {
      return json(200, [
        { id: INPUT_ID, name: 'Q', full_name: 'Materials2/Q', parent_folder_id: MATERIALS_ID },
        { id: OUTPUT_ID, name: 'A', full_name: 'Materials2/A', parent_folder_id: MATERIALS_ID },
      ]);
    }
    if (p === `/api/v1/folders/${INPUT_ID}/files`) {
      if (this.failInputListings > 0) {
        this.failInputListings--;
        return json(500, { errors: [{ message: 'Internal Server Error' }] });
      }
      const term = url.searchParams.get('search_term') ?? '';
      const files = this.input.filter((f) => f.name.includes(term)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return this.paged(res, url, files.map((f) => this.toCanvasFile(f)));
    }
    if (p === `/api/v1/folders/${OUTPUT_ID}/files`) return this.paged(res, url, this.output.map((f) => this.toCanvasFile(f)));
    const download = p.match(/^\/files\/(\d+)\/download$/);
    if (download) {
      const file = this.input.find((f) => f.id === Number(download[1]));
      if (!file) return json(404, {});
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return void res.end(file.body);
    }
    if (p === '/api/v1/users/self/files' && req.method === 'POST') {
      const { name } = JSON.parse((await readBody(req)).toString()) as { name: string };
      const token = `u${this.nextId++}`;
      this.pendingUploads.set(token, name);
      return json(200, { upload_url: `${this.baseUrl}/upload/${token}`, upload_params: { token } });
    }
    const upload = p.match(/^\/upload\/(\w+)$/);
    if (upload && req.method === 'POST') {
      const name = this.pendingUploads.get(upload[1]);
      if (!name) return json(400, {});
      const body = extractMultipartFile(await readBody(req), String(req.headers['content-type']));
      const existing = this.output.findIndex((f) => f.name === name);
      if (existing !== -1) this.output.splice(existing, 1);
      this.output.push({ id: this.nextId++, name, updatedAt: new Date().toISOString(), body });
      return json(201, { id: this.nextId });
    }

    if (p === '/api/v1/users/self') return json(200, { id: SELF_USER_ID });
    if (p === '/api/v1/conversations') return json(200, [{ id: SETTINGS_CONVERSATION_ID, subject: '[CFH:SETTINGS] Canvas Settings', updated_at: '2026-10-01T00:00:00Z' }]);
    if (p === `/api/v1/conversations/${SETTINGS_CONVERSATION_ID}`) {
      return json(200, { messages: [{ id: 1, body: `[CFH:SETTING:active_conversation_id] ${ACTIVE_CONVERSATION_ID}`, created_at: '2026-10-01T00:00:00Z' }] });
    }
    if (p === `/api/v1/conversations/${ACTIVE_CONVERSATION_ID}`) return json(200, { messages: [...this.conversation].reverse() });
    if (p === `/api/v1/conversations/${ACTIVE_CONVERSATION_ID}/add_message` && req.method === 'POST') {
      const body = new URLSearchParams((await readBody(req)).toString()).get('body') ?? '';
      this.conversation.push({ id: this.nextId++, body, created_at: new Date().toISOString() });
      return json(200, {});
    }
    json(404, { errors: [{ message: `fake canvas: no route for ${req.method} ${p}` }] });
  }

  private paged(res: http.ServerResponse, url: URL, items: unknown[]): void {
    const page = Number(url.searchParams.get('page') ?? '1');
    const slice = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (page * PAGE_SIZE < items.length) {
      const next = new URL(url.toString());
      next.searchParams.set('page', String(page + 1));
      headers.Link = `<${next.toString()}>; rel="next"`;
    }
    res.writeHead(200, headers);
    res.end(JSON.stringify(slice));
  }

  private toCanvasFile(f: StoredFile) {
    return { id: f.id, display_name: f.name, url: `${this.baseUrl}/files/${f.id}/download`, size: f.body.length, updated_at: f.updatedAt };
  }
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function extractMultipartFile(body: Buffer, contentType: string): Buffer {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return Buffer.alloc(0);
  const raw = body.toString('latin1');
  const part = raw.split(`--${boundary}`).find((section) => section.includes('filename='));
  if (!part) return Buffer.alloc(0);
  const content = part.slice(part.indexOf('\r\n\r\n') + 4, part.lastIndexOf('\r\n'));
  return Buffer.from(content, 'latin1');
}
