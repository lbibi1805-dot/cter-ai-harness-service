import { describe, it, expect } from 'vitest';
import { AnswerMode } from '../modules/agent/domain';
import { buildReply, parseRequest } from './conversationMessageParser';
import { parseFileName } from './fileParser';

describe('parseFileName — agent suffix', () => {
  it.each([
    ['START_bai1_openai.txt', AnswerMode.SINGLE_SHOT, undefined, 'START_bai1_openai_DONE.pdf'],
    ['START_bai1_openai_agent.txt', AnswerMode.AGENT, undefined, 'START_bai1_openai_agent_DONE.pdf'],
    ['START_bai1_openai_gpt-6-astra_agent.docx', AnswerMode.AGENT, 'gpt-6-astra', 'START_bai1_openai_gpt-6-astra_agent_DONE.pdf'],
    ['START_bai1_openai_AGENT.md', AnswerMode.AGENT, undefined, 'START_bai1_openai_AGENT_DONE.pdf'],
    ['START_agent_notes_gemini.txt', AnswerMode.SINGLE_SHOT, undefined, 'START_agent_notes_gemini_DONE.pdf'],
  ])('%s → %s', (name, mode, model, done) => {
    expect(parseFileName(name)).toMatchObject({ mode, model, doneFileName: done });
  });

  it('still rejects names without a provider', () => {
    expect(parseFileName('START_bai1_agent.txt')).toBeNull();
  });
});

describe('chat requests — mode header', () => {
  const body = (extra: string) => ['[CFH:REQUEST]', 'provider: openai', extra, '', 'What is a mutex?'].filter(Boolean).join('\n');

  it('reads mode: agent (case-insensitive) and defaults to single-shot', () => {
    expect(parseRequest(body('mode: agent')).mode).toBe(AnswerMode.AGENT);
    expect(parseRequest(body('Mode: AGENT')).mode).toBe(AnswerMode.AGENT);
    expect(parseRequest(body('')).mode).toBe(AnswerMode.SINGLE_SHOT);
    expect(parseRequest(body('mode: turbo')).mode).toBe(AnswerMode.SINGLE_SHOT);
  });

  it('writes the mode header only for agent replies (legacy replies unchanged)', () => {
    const base = { requestId: 1, status: 'done' as const, provider: 'openai', model: 'gpt-6-astra', content: 'A' };
    expect(buildReply({ ...base, mode: AnswerMode.AGENT })).toContain('mode: agent');
    expect(buildReply({ ...base, mode: AnswerMode.SINGLE_SHOT })).not.toContain('mode:');
    expect(buildReply(base)).toBe(['[CFH:REPLY]', 'request_id: 1', 'status: done', 'provider: openai', 'model: gpt-6-astra', '', 'A'].join('\n'));
  });
});
