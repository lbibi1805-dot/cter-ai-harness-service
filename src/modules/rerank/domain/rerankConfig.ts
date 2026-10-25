import { RerankProvider } from './enums/rerank.enums';

/** Unknown values disable reranking rather than failing startup. */
export function parseRerankProvider(value: string | undefined): RerankProvider {
  return value === RerankProvider.PINECONE ? RerankProvider.PINECONE : RerankProvider.NONE;
}
