import { ConversationRole } from '../enums/ai.enums';
import { ConversationTurn, PromptContent } from '../interfaces/promptContent.interface';
import { MAX_HISTORY_CHARS, MAX_HISTORY_TURNS, MAX_HISTORY_TURN_CHARS, TRUNCATED_TURN_SUFFIX } from '../constants/conversation.constants';

/**
 * Makes client-sent history safe for every vendor API: drops empty turns,
 * merges consecutive turns of the same role, starts with a user turn and ends
 * with an assistant turn (the current question follows as the next user turn),
 * then keeps the newest turns within the size limits.
 */
export function normalizeHistory(turns: ConversationTurn[]): ConversationTurn[] {
  const merged: ConversationTurn[] = [];
  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last?.role === turn.role) last.text = `${last.text}\n\n${text}`;
    else merged.push({ role: turn.role, text });
  }
  while (merged.length > 0 && merged[merged.length - 1].role !== ConversationRole.ASSISTANT) merged.pop();

  const kept: ConversationTurn[] = [];
  let chars = 0;
  for (let i = merged.length - 1; i >= 0 && kept.length < MAX_HISTORY_TURNS; i--) {
    const text = truncateTurn(merged[i].text);
    if (chars + text.length > MAX_HISTORY_CHARS) break;
    chars += text.length;
    kept.unshift({ role: merged[i].role, text });
  }
  while (kept.length > 0 && kept[0].role !== ConversationRole.USER) kept.shift();
  return kept;
}

/**
 * Query for RAG retrieval: a follow-up such as "explain that more" finds
 * nothing on its own, so the previous user question is searched along with it.
 */
export function retrievalQuery(content: PromptContent): string {
  const question = content.textContent;
  const previous = [...(content.history ?? [])].reverse().find((turn) => turn.role === ConversationRole.USER);
  return previous ? `${previous.text}\n${question}` : question;
}

function truncateTurn(text: string): string {
  return text.length > MAX_HISTORY_TURN_CHARS ? text.slice(0, MAX_HISTORY_TURN_CHARS) + TRUNCATED_TURN_SUFFIX : text;
}
