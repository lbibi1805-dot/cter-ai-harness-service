import { GoogleGenerativeAI, type Content, type Part } from '@google/generative-ai';
import { UpstreamError } from '../../../../shared/errors';
import { GEMINI_MODELS_URL } from '../../domain/constants/ai.constants';
import { ConversationRole } from '../../domain/enums/ai.enums';
import type { AIAdapter, ProviderReply } from '../../domain/interfaces/aiProvider.port';
import { PromptContent } from '../../domain/interfaces/promptContent.interface';

export class GeminiAdapter implements AIAdapter {
  private readonly client: GoogleGenerativeAI;

  constructor(private readonly apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async validate(): Promise<void> {
    const url = new URL(GEMINI_MODELS_URL);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('pageSize', '1');
    const res = await fetch(url);
    if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`, res.status);
  }

  async process(content: PromptContent, systemPrompt: string, model: string): Promise<ProviderReply> {
    const generativeModel = this.client.getGenerativeModel({ model, systemInstruction: systemPrompt });
    const parts: Part[] = [];
    if (content.textContent) parts.push({ text: content.textContent });
    for (const image of content.imageBuffers) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } });
    }
    const history: Content[] = (content.history ?? []).map((turn) => ({
      role: turn.role === ConversationRole.USER ? 'user' : 'model',
      parts: [{ text: turn.text }],
    }));
    const result = await generativeModel.generateContent({ contents: [...history, { role: 'user', parts }] });
    return { text: result.response.text(), model };
  }
}
