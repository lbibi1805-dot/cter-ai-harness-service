import { type RecordMetadata } from '@pinecone-database/pinecone';
import type { ChunkMetadata } from '../../domain/interfaces/retrieval.interface';

export type PineconeChunkMetadata = ChunkMetadata & RecordMetadata;
