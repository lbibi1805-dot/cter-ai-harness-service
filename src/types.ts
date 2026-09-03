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

// ── RAG / Document Vault ─────────────────────────────────────────

export interface CitedChunk {
  chunkId: string;
  text: string;
  source: string;
  heading: string;
  parentHeading: string;
  tokenCount: number;
  score?: number;
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
