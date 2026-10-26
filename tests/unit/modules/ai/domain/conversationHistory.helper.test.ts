import { describe, it, expect } from 'vitest';
import { ConversationRole } from '../../../../../src/modules/ai';
import { normalizeHistory, retrievalQuery } from '../../../../../src/modules/ai/domain/helpers/conversationHistory.helper';
import { MAX_HISTORY_CHARS, MAX_HISTORY_TURNS, MAX_HISTORY_TURN_CHARS } from '../../../../../src/modules/ai/domain/constants/conversation.constants';

const user = (text: string) => ({ role: ConversationRole.USER, text });
const assistant = (text: string) => ({ role: ConversationRole.ASSISTANT, text });

describe('normalizeHistory', () => {
  it('drops empty turns, merges same-role runs and trims to user…assistant', () => {
    expect(normalizeHistory([assistant('hello'), user('a'), user('  '), user('b'), assistant('c'), user('pending')])).toEqual([
      user('a\n\nb'),
      assistant('c'),
    ]);
  });

  it('returns nothing when no turn was answered', () => {
    expect(normalizeHistory([user('q')])).toEqual([]);
  });

  it('keeps the newest turns within the turn limit, still starting with a user turn', () => {
    const turns = Array.from({ length: MAX_HISTORY_TURNS + 6 }, (_, i) => (i % 2 === 0 ? user(`q${i}`) : assistant(`a${i}`)));
    const kept = normalizeHistory(turns);
    expect(kept.length).toBeLessThanOrEqual(MAX_HISTORY_TURNS);
    expect(kept[0].role).toBe(ConversationRole.USER);
    expect(kept[kept.length - 1]).toEqual(turns[turns.length - 1]);
  });

  it('cuts long turns and drops the oldest ones past the character budget', () => {
    const long = 'x'.repeat(MAX_HISTORY_TURN_CHARS * 2);
    const turns = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? user(long) : assistant(long)));
    const kept = normalizeHistory(turns);
    expect(kept.every((turn) => turn.text.length < MAX_HISTORY_TURN_CHARS + 20)).toBe(true);
    expect(kept.reduce((sum, turn) => sum + turn.text.length, 0)).toBeLessThanOrEqual(MAX_HISTORY_CHARS);
    expect(kept[0].role).toBe(ConversationRole.USER);
  });
});

describe('retrievalQuery', () => {
  it('searches the previous user question along with a follow-up', () => {
    const content = { textContent: 'explain more', imageBuffers: [], history: [user('What is a mutex?'), assistant('A lock.')] };
    expect(retrievalQuery(content)).toBe('What is a mutex?\nexplain more');
  });

  it('is the question alone without history', () => {
    expect(retrievalQuery({ textContent: 'q', imageBuffers: [] })).toBe('q');
  });
});
