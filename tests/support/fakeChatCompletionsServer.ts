// OpenRouter-style stand-in for POST /chat/completions and GET /models so tests
// drive the real `openai` SDK. Each request is answered by a scripted responder;
// every request body and header set is recorded for assertions.
import * as http from 'http';
import type { AddressInfo } from 'net';

export interface ChatRequestBody {
  model: string;
  models?: string[];
  provider?: { sort?: string; allow_fallbacks: boolean };
  messages: Array<Record<string, unknown>>;
  tools?: Array<{ type: string; function: { name: string } }>;
  tool_choice?: string;
}

export type ScriptedChatOutput =
  | { toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> }
  | { text: string; servedBy?: string }
  /** HTTP error status with an OpenAI-style error body. */
  | { status: number; error: string }
  /** HTTP 200 carrying an `error` object and no choices (OpenRouter mid-generation failure). */
  | { bodyError: { code: number; message: string } }
  | { noChoices: true };

export type ChatResponder = (body: ChatRequestBody, requestIndex: number) => ScriptedChatOutput;

export class FakeChatCompletionsServer {
  readonly requests: ChatRequestBody[] = [];
  readonly headers: http.IncomingHttpHeaders[] = [];
  responder: ChatResponder = () => ({ text: 'default answer' });
  /** Served by GET /models: model ids that list `tools` among their supported parameters. */
  toolModels: string[] = [];
  baseURL = '';
  private readonly server = http.createServer((req, res) => void this.handle(req, res));
  private callSeq = 0;

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.baseURL = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/api/v1`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url?.endsWith('/models')) {
      const data = this.toolModels.map((id) => ({ id, object: 'model', created: 0, owned_by: 'test', supported_parameters: ['tools', 'tool_choice'] }));
      return this.json(res, 200, { object: 'list', data });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as ChatRequestBody;
    this.requests.push(body);
    this.headers.push(req.headers);
    const scripted = this.responder(body, this.requests.length - 1);

    if ('status' in scripted) return this.json(res, scripted.status, { error: { message: scripted.error, code: scripted.status } });
    if ('bodyError' in scripted) return this.json(res, 200, { id: 'gen', object: 'chat.completion', model: body.model, error: scripted.bodyError });
    if ('noChoices' in scripted) return this.json(res, 200, { id: 'gen', object: 'chat.completion', model: body.model, choices: [] });

    const toolCalls = 'toolCalls' in scripted
      ? scripted.toolCalls.map((call) => ({ id: `call_${++this.callSeq}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.arguments) } }))
      : undefined;
    const message = toolCalls
      ? { role: 'assistant', content: null, tool_calls: toolCalls }
      : { role: 'assistant', content: (scripted as { text: string }).text };
    this.json(res, 200, {
      id: `gen_${this.requests.length}`,
      object: 'chat.completion',
      created: 0,
      model: ('servedBy' in scripted && scripted.servedBy) || body.model,
      choices: [{ index: 0, message, finish_reason: toolCalls ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
    });
  }

  private json(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }
}
