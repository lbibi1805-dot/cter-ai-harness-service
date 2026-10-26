import type { EmbeddingService } from '../domain/interfaces/embedding.port';
import { EmbeddingProvider } from '../domain/enums/retrieval.enums';
import { EmbeddingKeyMissingError } from '../domain/errors/retrieval.errors';
import type { EmbeddingKeys } from '../domain/interfaces/retrieval.interface';
import { GeminiEmbeddingAdapter } from './geminiEmbedding.adapter';
import { OpenAIEmbeddingAdapter } from './openaiEmbedding.adapter';

/** Embeddings always use a direct key (never OpenRouter): the vectors must match the Pinecone index. */
export function createEmbeddingService(provider: EmbeddingProvider, keys: EmbeddingKeys): EmbeddingService {
  if (provider === EmbeddingProvider.GEMINI) {
    if (!keys.gemini) throw new EmbeddingKeyMissingError(provider, 'GEMINI_API_KEY');
    return new GeminiEmbeddingAdapter(keys.gemini);
  }
  if (!keys.openai) throw new EmbeddingKeyMissingError(provider, 'OPENAI_API_KEY');
  return new OpenAIEmbeddingAdapter(keys.openai);
}
