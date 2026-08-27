import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import type { AppConfig, VaultConfig } from './types';

function loadFile(filePath: string, required: true): string;
function loadFile(filePath: string, required: false): string;
function loadFile(filePath: string, required: boolean): string {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    if (required) throw new Error(`Required file not found: ${filePath}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf-8').trim();
}

export function loadConfig(): AppConfig {
  const accounts = [];
  for (let i = 1; ; i++) {
    const url = process.env[`CANVAS_URL_${i}`];
    const apiKey = process.env[`CANVAS_KEY_${i}`];
    if (!url || !apiKey) break;
    const email = process.env[`CANVAS_EMAIL_${i}`] || undefined;
    accounts.push({ url, apiKey, index: i, email });
  }
  if (accounts.length === 0) {
    throw new Error('No Canvas accounts configured. Set CANVAS_URL_1 and CANVAS_KEY_1 in .env');
  }

  const systemPrompt = loadFile('system-prompt.md', false) || 'You are a helpful assistant.';
  const knowledgeContent = loadFile('knowledge.md', false);

  return {
    accounts,
    aiKeys: {
      claude: process.env.CLAUDE_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      grok: process.env.GROK_API_KEY,
      openai: process.env.OPENAI_API_KEY,
    },
    defaultModels: {
      claude: process.env.DEFAULT_MODEL_CLAUDE ?? 'claude-sonnet-4-6',
      gemini: process.env.DEFAULT_MODEL_GEMINI ?? 'gemini-2.0-flash',
      grok: process.env.DEFAULT_MODEL_GROK ?? 'grok-3',
    },
    modelFallback: {
      claude: (process.env.MODEL_FALLBACK_CLAUDE ?? 'claude-sonnet-4-6,claude-haiku-4-5-20251001').split(',').map(s => s.trim()).filter(Boolean),
      gemini: (process.env.MODEL_FALLBACK_GEMINI ?? 'gemini-3.5-flash,gemini-3.1-flash-lite,gemini-2.5-flash-lite').split(',').map(s => s.trim()).filter(Boolean),
      grok: (process.env.MODEL_FALLBACK_GROK ?? 'grok-3,grok-4-1-fast-reasoning').split(',').map(s => s.trim()).filter(Boolean),
    },
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10),
    maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT ?? '3', 10),
    systemPrompt,
    knowledgeContent,
    grokBaseUrl: process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1',
    aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? '120000', 10),
    gmail: {
      user: process.env.GMAIL_USER,
      appPassword: process.env.GMAIL_APP_PASSWORD,
    },
    vaultConfig: process.env.PINECONE_API_KEY
      ? {
          pineconeApiKey: process.env.PINECONE_API_KEY,
          pineconeIndex: process.env.PINECONE_INDEX ?? 'canvashelper-kb',
          embeddingProvider: (process.env.EMBEDDING_PROVIDER as 'gemini' | 'openai') ?? 'gemini',
          vaultPath: process.env.VAULT_PATH ?? './documents-vault',
          topK: parseInt(process.env.RAG_TOP_K ?? '6', 10),
        }
      : undefined,
    canvasFolder: {
      materials: process.env.CANVAS_MATERIALS_FOLDER ?? 'Materials2',
      input: process.env.CANVAS_INPUT_FOLDER ?? 'Q',
      output: process.env.CANVAS_OUTPUT_FOLDER ?? 'A',
    },
  };
}
