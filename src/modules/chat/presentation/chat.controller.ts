import { readJsonBody } from '../../../shared/http/body';
import { HttpStatus } from '../../../shared/http/enums/http.enums';
import { sendJson } from '../../../shared/http/response';
import type { ChatService } from '../application/chat.service';
import { toChatAnswerDto, toChatQuestion } from './mappers/chat.mapper';
import { RouteContext } from '../../../shared/http/interfaces/router.interface';
import { MAX_CHAT_BODY_BYTES } from './constants/chat.constants';

/** HTTP adapter for the chat API: parse the request, call ChatService, shape the JSON. */
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  status = async ({ res }: RouteContext): Promise<void> => {
    sendJson(res, HttpStatus.OK, { ok: true, ...this.chat.status() });
  };

  ask = async ({ req, res }: RouteContext): Promise<void> => {
    this.chat.ensureEnabled();
    const question = toChatQuestion(await readJsonBody(req, MAX_CHAT_BODY_BYTES));
    sendJson(res, HttpStatus.OK, toChatAnswerDto(await this.chat.ask(question)));
  };
}
