import { describe, it, expect, vi } from 'vitest';
import { executeAIInvocation } from './executeAIInvocation';
import type { AIAdapter, FileContent } from '../../types';

describe('application/ai executeAIInvocation', () => {
  const content: FileContent = { textContent: 'q', imageBuffers: [] };

  it('calls adapter.process with the given content/systemPrompt/model and returns its result', async () => {
    const adapter: AIAdapter = { process: vi.fn().mockResolvedValue('answer'), validate: vi.fn() };
    const result = await executeAIInvocation({
      adapter, content, systemPrompt: 'SYS', model: 'gpt-5', timeoutMs: 1000, timeoutLabel: 'openai/gpt-5',
    });
    expect(result).toBe('answer');
    expect(adapter.process).toHaveBeenCalledWith(content, 'SYS', 'gpt-5');
  });

  it('rejects with a timeout error (matching withTimeout label) when the adapter hangs', async () => {
    const adapter: AIAdapter = { process: () => new Promise(() => {}), validate: vi.fn() };
    await expect(executeAIInvocation({
      adapter, content, systemPrompt: 'SYS', model: 'gpt-5', timeoutMs: 10, timeoutLabel: 'openai/gpt-5',
    })).rejects.toThrow('AI timeout after 10ms (openai/gpt-5)');
  });

  it('propagates adapter errors unchanged (no retry inside executeAIInvocation)', async () => {
    const adapter: AIAdapter = { process: vi.fn().mockRejectedValue(new Error('rate limited')), validate: vi.fn() };
    await expect(executeAIInvocation({
      adapter, content, systemPrompt: 'SYS', model: 'gpt-5', timeoutMs: 1000, timeoutLabel: 'openai/gpt-5',
    })).rejects.toThrow('rate limited');
    expect(adapter.process).toHaveBeenCalledTimes(1);
  });
});
