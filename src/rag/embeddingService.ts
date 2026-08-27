import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { EmbeddingProviderName } from '../types';

export interface IEmbeddingService {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimension: number;
  readonly provider: EmbeddingProviderName;
}

export class GeminiEmbeddingService implements IEmbeddingService {
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  // gemini-embedding-001 returns 3072-dim vectors by default.
  readonly dimension = 3072;
  readonly provider: EmbeddingProviderName = 'gemini';

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.model.embedContent(text);
    return result.embedding.values ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results = await Promise.all(texts.map(t => this.embed(t)));
    return results;
  }
}

export class OpenAIEmbeddingService implements IEmbeddingService {
  private client: OpenAI;
  readonly dimension = 1536;
  readonly provider: EmbeddingProviderName = 'openai';

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(d => d.embedding);
  }
}

export function createEmbeddingService(
  provider: EmbeddingProviderName,
  aiKeys: { gemini?: string; openai?: string },
): IEmbeddingService {
  if (provider === 'gemini') {
    if (!aiKeys.gemini) throw new Error('GEMINI_API_KEY required for Gemini embedding');
    return new GeminiEmbeddingService(aiKeys.gemini);
  }
  if (!aiKeys.openai) throw new Error('OPENAI_API_KEY required for OpenAI embedding');
  return new OpenAIEmbeddingService(aiKeys.openai);
}
