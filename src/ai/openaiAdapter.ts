import OpenAI from 'openai';
import type { AIAdapter, FileContent } from '../types';
import { getModelApiMode } from '../config/allowedModels';

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async validate(): Promise<void> {
    await this.client.models.list();
  }

  async process(content: FileContent, systemPrompt: string, model: string): Promise<string> {
    const apiMode = getModelApiMode('openai', model);
    if (!apiMode) throw new Error(`Unsupported OpenAI model: ${model}`);
    if (apiMode === 'responses') {
      const input: OpenAI.Responses.ResponseInput = [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        {
          role: 'user',
          content: [
            ...(content.textContent ? [{ type: 'input_text' as const, text: content.textContent }] : []),
            ...content.imageBuffers.map((img) => ({
              type: 'input_image' as const,
              image_url: `data:${img.mimeType};base64,${img.data.toString('base64')}`,
              detail: 'auto' as const,
            })),
          ],
        },
      ];
      const response = await this.client.responses.create({ model, input });
      return response.output_text ?? '';
    }

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
