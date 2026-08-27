import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type { AIAdapter, FileContent } from '../types';

export class GeminiAdapter implements AIAdapter {
  constructor(private apiKey: string) {}

  async validate(): Promise<void> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}&pageSize=1`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async process(content: FileContent, systemPrompt: string, model: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const genModel = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt });

    const parts: Part[] = [];
    if (content.textContent) parts.push({ text: content.textContent });
    for (const img of content.imageBuffers) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data.toString('base64') } });
    }

    const result = await genModel.generateContent(parts);
    return result.response.text();
  }
}
