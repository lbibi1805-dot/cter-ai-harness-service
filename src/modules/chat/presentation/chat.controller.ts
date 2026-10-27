import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { ChatService } from '../application/chat.service';
import { toChatAnswerDto, toChatQuestion } from './mappers/chat.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { MAX_CHAT_BODY_BYTES } from './constants/chat.constants';
import { ChatStreamEvent } from './enums/chat.enums';
import { NdjsonStream } from '../../../shared/http/ndjson';

/** HTTP adapter for the chat API: parse the request, call ChatService, shape the JSON. */
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  status = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { ok: true, ...this.chat.status() });
  };

  ask = async ({ req, res }: RouteContext): Promise<void> => {
    this.chat.ensureEnabled();
    const question = toChatQuestion(await readJsonBody(req, MAX_CHAT_BODY_BYTES));
    if (!question.stream) return sendJson(res, HttpStatus.OK, toChatAnswerDto(await this.chat.ask(question)));

    // The status line goes out with the first event, so errors before any text still get their HTTP status.
    const out = new NdjsonStream(res);
    const answer = await this.chat.ask(question, {
      delta: (text) => out.write({ type: ChatStreamEvent.DELTA, text }),
      reset: () => out.write({ type: ChatStreamEvent.RESET }),
    });
    out.end({ type: ChatStreamEvent.DONE, ...toChatAnswerDto(answer) });
  };
}
