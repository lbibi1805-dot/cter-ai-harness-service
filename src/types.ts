import type { DatabaseSettings } from './shared/database/database';
import type { AnswerMode } from './modules/agent/domain/agent.enums';
import type { RerankConfig } from './modules/rerank/domain/rerankConfig';

export type AIProviderName = 'claude' | 'gemini' | 'grok' | 'openai';

export interface CanvasAccountConfig {
  url: string;
  apiKey: string;
  index: number;
  email?: string;
}

export interface AppConfig {
  accounts: CanvasAccountConfig[];
  aiKeys: { claude?: string; gemini?: string; grok?: string; openai?: string };
  defaultModels: { claude: string; gemini: string; grok: string; openai: string };
  modelFallback: Record<AIProviderName, string[]>;
  pollIntervalMs: number;
  maxRetryCount: number;
  systemPrompt: string;
  knowledgeContent: string;
  grokBaseUrl: string;
  aiTimeoutMs: number;
  gmail: { user?: string; appPassword?: string };
  vaultConfig?: VaultConfig;
  /** Neon (prod) or local JSON files — shared by vault manifest and poll cursors. */
  database: DatabaseSettings;
  /** Start polling on boot instead of waiting for GET /start. */
  pollAutostart: boolean;
  /** Limits for agent-mode answers (opt-in per request). */
  agent: { maxToolCalls: number; minToolCalls: number; maxDurationMs: number };
  /** Cross-encoder reranking of vector-search candidates (off unless RERANK_PROVIDER=pinecone). */
  rerank: RerankConfig;
  /** Bearer token for write endpoints; unset means open (legacy behaviour). */
  adminToken?: string;
  canvasFolder: {
    materials: string;
    input: string;
    output: string;
  };
}

export type FileStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface ParsedFileName {
  originalName: string;
  provider: AIProviderName;
  model?: string;
  extension: string;
  doneFileName: string;
  mode: AnswerMode;
}

export interface FileContent {
  textContent: string;
  imageBuffers: { data: Buffer; mimeType: string }[];
}

export interface ProcessingRecord {
  fileId: string;
  fileName: string;
  accountIndex: number;
  status: FileStatus;
  retryCount: number;
  updatedAt: string;
  error?: string;
}

export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  size: number;
  updated_at: string;
}

export interface AIAdapter {
  process(content: FileContent, systemPrompt: string, model: string): Promise<string>;
  validate(): Promise<void>;
}

// ── Canvas Conversations (extension chat — additive, Q/A file flow untouched) ──

export interface ConversationAttachment {
  id: string;
  filename: string;
  url: string;
  contentType?: string;
}

export interface ConversationMessage {
  id: number;
  body: string;
  createdAt: string;
  attachments: ConversationAttachment[];
}

export type ConversationReplyStatus = 'done' | 'failed' | 'invalid-format' | 'pending';

export interface ParsedConversationRequest {
  provider: AIProviderName | string;
  model?: string;
  question: string;
  valid: boolean;
  error?: string;
  mode: AnswerMode;
}

export interface ConversationReply {
  requestId: number;
  status: ConversationReplyStatus;
  provider: string;
  model: string;
  content: string;
  /** Only written for agent answers, so legacy clients see unchanged replies. */
  mode?: AnswerMode;
}

// ── RAG / Document Vault ─────────────────────────────────────────

export interface CitedChunk {
  chunkId: string;
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  /** Vector (cosine) similarity from Pinecone. */
  score?: number;
  /** Cross-encoder relevance in [0, 1], set when the chunk went through the reranker. */
  rerankScore?: number;
}

export type EmbeddingProviderName = 'gemini' | 'openai';

export interface VaultConfig {
  pineconeApiKey: string;
  pineconeIndex: string;
  embeddingProvider: EmbeddingProviderName;
  vaultPath: string;
  topK?: number;
  embeddingDelayMs: number;
  embeddingBatchSize: number;
}

export interface CitationResult {
  systemPrompt: string;
  userContent: string;
}
