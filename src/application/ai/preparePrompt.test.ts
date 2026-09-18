import { describe, it, expect, vi } from 'vitest';
import { preparePrompt } from './preparePrompt';
import type { FileContent } from '../../types';

describe('application/ai preparePrompt — parity with PollOrchestrator/ConversationPoller.preparePrompt', () => {
  const content: FileContent = { textContent: 'What is a mutex?', imageBuffers: [] };

  it('falls back to knowledge injection when no RAG refs are provided', async () => {
    const result = await preparePrompt(content, 'BASE_PROMPT', 'KNOWLEDGE_MD', {});
    expect(result.systemPrompt).toBe('BASE_PROMPT');
    expect(result.fileContent.textContent).toContain('What is a mutex?');
  });

  it('falls back to knowledge injection when textContent is blank even with RAG refs present', async () => {
    const retriever = { retrieve: vi.fn() };
    const builder = { build: vi.fn() };
    const result = await preparePrompt({ textContent: '   ', imageBuffers: [] }, 'BASE_PROMPT', 'KNOWLEDGE_MD', { retriever, builder });
    expect(retriever.retrieve).not.toHaveBeenCalled();
    expect(result.systemPrompt).toBe('BASE_PROMPT');
  });

  it('uses RAG retriever + citation builder when both are present and text is non-blank', async () => {
    const chunks = [{ chunkId: 'c1', text: 'x', source: 's.md', heading: 'H', parentHeading: '', tokenCount: 1 }];
    const retriever = { retrieve: vi.fn().mockResolvedValue(chunks) };
    const builder = { build: vi.fn().mockReturnValue({ systemPrompt: 'BASE_PROMPT\n\nRULES', userContent: 'CONTEXT\n\nWhat is a mutex?' }) };
    const result = await preparePrompt(content, 'BASE_PROMPT', 'KNOWLEDGE_MD', { retriever, builder });
    expect(retriever.retrieve).toHaveBeenCalledWith('What is a mutex?');
    expect(builder.build).toHaveBeenCalledWith('BASE_PROMPT', chunks, 'What is a mutex?');
    expect(result.systemPrompt).toBe('BASE_PROMPT\n\nRULES');
    expect(result.fileContent.textContent).toBe('CONTEXT\n\nWhat is a mutex?');
    expect(result.fileContent.imageBuffers).toEqual(content.imageBuffers);
  });

  it('falls back to knowledge injection when RAG retrieval throws', async () => {
    const retriever = { retrieve: vi.fn().mockRejectedValue(new Error('pinecone down')) };
    const builder = { build: vi.fn() };
    const result = await preparePrompt(content, 'BASE_PROMPT', 'KNOWLEDGE_MD', { retriever, builder });
    expect(builder.build).not.toHaveBeenCalled();
    expect(result.systemPrompt).toBe('BASE_PROMPT');
    expect(result.fileContent.textContent).toContain('What is a mutex?');
  });
});
