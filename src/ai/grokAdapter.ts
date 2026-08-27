import OpenAI from 'openai';
import type { AIAdapter, FileContent } from '../types';

export class GrokAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string, baseURL: string) {
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: FileContent, systemPrompt: string, model: string): Promise<string> {
    const userContent: OpenAI.ChatCompletionContentPart[] = [];
    if (content.textContent) {
      userContent.push({ type: 'text', text: content.textContent });
    }
    for (const img of content.imageBuffers) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.data.toString('base64')}` },
      });
    }

    const response = await this.client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
    return response.choices[0].message.content ?? '';
  }
}
