// OpenAI-compatible stand-in for POST /v1/responses so tests drive the real
// `openai` SDK through function calling. Each request is answered by a
// scripted responder; every request body is recorded for assertions.
import * as http from 'http';
import type { AddressInfo } from 'net';

export interface ResponsesRequestBody {
  model: string;
  input: Array<Record<string, unknown>>;
  tools?: Array<{ name: string }>;
  tool_choice?: string;
}

export type ScriptedOutput =
  | { functionCall: { name: string; arguments: Record<string, unknown> } }
  | { functionCalls: Array<{ name: string; arguments: Record<string, unknown> }> }
  | { text: string }
  | { status: number; error: string };

export type Responder = (body: ResponsesRequestBody, requestIndex: number) => ScriptedOutput;

export class FakeOpenAIResponsesServer {
  readonly requests: ResponsesRequestBody[] = [];
  responder: Responder = () => ({ text: 'default answer' });
  /** Artificial per-request latency (load tests). */
  latencyMs = 0;
  private server = http.createServer((req, res) => void this.handle(req, res));
  private callSeq = 0;
  baseURL = '';

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.baseURL = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/v1`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  /** All function_call_output strings the client has sent so far (latest request). */
  lastToolOutputs(): string[] {
    const last = this.requests[this.requests.length - 1];
    return (last?.input ?? []).filter((i) => i.type === 'function_call_output').map((i) => String(i.output));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as ResponsesRequestBody;
    this.requests.push(body);
    const scripted = this.responder(body, this.requests.length - 1);
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    if ('status' in scripted) {
      res.writeHead(scripted.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: scripted.error, type: 'test_error' } }));
      return;
    }
    const calls = 'functionCall' in scripted ? [scripted.functionCall] : 'functionCalls' in scripted ? scripted.functionCalls : [];
    const output = calls.length > 0
      ? calls.map((call) => {
        const id = ++this.callSeq;
        return { type: 'function_call', id: `fc_${id}`, call_id: `call_${id}`, name: call.name, arguments: JSON.stringify(call.arguments), status: 'completed' };
      })
      : [{ type: 'message', id: `msg_${this.requests.length}`, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: (scripted as { text: string }).text, annotations: [] }] }];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: `resp_${this.requests.length}`, object: 'response', created_at: 0, status: 'completed', model: body.model,
      output, usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
    }));
  }
}
