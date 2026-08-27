import Anthropic from '@anthropic-ai/sdk';
import type { AIAdapter, FileContent } from '../types';

export class ClaudeAdapter implements AIAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: FileContent, systemPrompt: string, model: string): Promise<string> {
    const userContent: Anthropic.MessageParam['content'] = [];

    if (content.textContent) {
      userContent.push({ type: 'text', text: content.textContent });
    }
    for (const img of content.imageBuffers) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: img.data.toString('base64'),
        },
      });
    }

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    return (response.content[0] as { type: 'text'; text: string }).text;
  }
}
