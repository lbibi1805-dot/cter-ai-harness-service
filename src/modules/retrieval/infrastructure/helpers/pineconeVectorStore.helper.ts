import { PINECONE_BATCH_SIZE } from '../../domain/constants/retrieval.constants';

export function inBatches<T>(items: readonly T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += PINECONE_BATCH_SIZE) batches.push(items.slice(i, i + PINECONE_BATCH_SIZE));
  return batches;
}
