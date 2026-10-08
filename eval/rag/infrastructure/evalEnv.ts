import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'dotenv';
import { EvalEmbeddingProvider, EvalEnvKey } from '../domain';

export const DEFAULT_EVAL_ENV_FILE = path.resolve(__dirname, '..', '..', '.env.eval');

export interface EvalSettings {
  pineconeApiKey: string;
  pineconeIndex: string;
  embeddingProvider: EvalEmbeddingProvider;
  openaiApiKey?: string;
  geminiApiKey?: string;
}

/**
 * Reads credentials from the eval env file only. It deliberately does not
 * touch `process.env` or the app's `.env`, so an eval run can never pick up
 * (or leak into) the service configuration by accident.
 */
export function loadEvalSettings(envFile: string = DEFAULT_EVAL_ENV_FILE): EvalSettings {
  if (!fs.existsSync(envFile)) {
    throw new Error(`Missing ${envFile}. Copy eval/.env.eval.example to eval/.env.eval and fill in the Pinecone credentials.`);
  }
  const values = parse(fs.readFileSync(envFile));
  const required = (key: EvalEnvKey): string => {
    const value = values[key]?.trim();
    if (!value) throw new Error(`${key} is empty in ${envFile}`);
    return value;
  };

  const provider = required(EvalEnvKey.EMBEDDING_PROVIDER) as EvalEmbeddingProvider;
  if (!Object.values(EvalEmbeddingProvider).includes(provider)) {
    throw new Error(`${EvalEnvKey.EMBEDDING_PROVIDER} must be one of: ${Object.values(EvalEmbeddingProvider).join(', ')}`);
  }
  const settings: EvalSettings = {
    pineconeApiKey: required(EvalEnvKey.PINECONE_API_KEY),
    pineconeIndex: required(EvalEnvKey.PINECONE_INDEX),
    embeddingProvider: provider,
    openaiApiKey: values[EvalEnvKey.OPENAI_API_KEY]?.trim() || undefined,
    geminiApiKey: values[EvalEnvKey.GEMINI_API_KEY]?.trim() || undefined,
  };
  if (provider === EvalEmbeddingProvider.OPENAI && !settings.openaiApiKey) required(EvalEnvKey.OPENAI_API_KEY);
  if (provider === EvalEmbeddingProvider.GEMINI && !settings.geminiApiKey) required(EvalEnvKey.GEMINI_API_KEY);
  return settings;
}

/** "pcsk_abc…xyz" — enough to recognise which key is in use, never the secret. */
export function maskSecret(secret: string): string {
  return secret.length <= 8 ? '****' : `${secret.slice(0, 4)}…${secret.slice(-3)}`;
}
