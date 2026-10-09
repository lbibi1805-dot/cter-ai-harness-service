import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'dotenv';
import { getModelApiMode } from '../../../src/config/allowedModels';
import { EvalEnvKey } from '../../rag/domain';
import { DEFAULT_EVAL_ENV_FILE, loadEvalSettings, type EvalSettings } from '../../rag/infrastructure/evalEnv';

export const DEFAULT_ANSWER_MODEL = 'gpt-6-astra';
export const DEFAULT_JUDGE_MODEL = 'gpt-4o';
export const DEFAULT_RAG_TOP_K = 20;
export const DEFAULT_SYSTEM_PROMPT_FILE = path.resolve(__dirname, '..', '..', '..', 'system-prompt.md');

export interface AnswerEvalSettings extends EvalSettings {
  openaiApiKey: string;
  databaseUrl: string;
  answerModel: string;
  judgeModel: string;
  ragTopK: number;
  systemPrompt: string;
}

/** Extends the retrieval-eval settings with what the answer eval needs (same gitignored file). */
export function loadAnswerEvalSettings(envFile: string = DEFAULT_EVAL_ENV_FILE): AnswerEvalSettings {
  const base = loadEvalSettings(envFile);
  const values = parse(fs.readFileSync(envFile));
  const value = (key: EvalEnvKey) => values[key]?.trim() || undefined;

  const openaiApiKey = base.openaiApiKey;
  if (!openaiApiKey) throw new Error(`${EvalEnvKey.OPENAI_API_KEY} is required: answers and grading use OpenAI`);
  const databaseUrl = value(EvalEnvKey.DATABASE_URL);
  if (!databaseUrl) throw new Error(`${EvalEnvKey.DATABASE_URL} is required: reference documents and agent reads come from the vault (SELECT only)`);

  const answerModel = value(EvalEnvKey.ANSWER_MODEL) ?? DEFAULT_ANSWER_MODEL;
  if (getModelApiMode('openai', answerModel) !== 'responses') {
    throw new Error(`${EvalEnvKey.ANSWER_MODEL}=${answerModel} cannot run agent mode; use a Responses-API model (e.g. ${DEFAULT_ANSWER_MODEL}) so both modes are compared fairly`);
  }
  const promptFile = value(EvalEnvKey.SYSTEM_PROMPT_FILE) ?? DEFAULT_SYSTEM_PROMPT_FILE;
  const ragTopK = Number(value(EvalEnvKey.RAG_TOP_K) ?? DEFAULT_RAG_TOP_K);

  return {
    ...base,
    openaiApiKey,
    databaseUrl,
    answerModel,
    judgeModel: value(EvalEnvKey.JUDGE_MODEL) ?? DEFAULT_JUDGE_MODEL,
    ragTopK: Number.isInteger(ragTopK) && ragTopK > 0 ? ragTopK : DEFAULT_RAG_TOP_K,
    systemPrompt: fs.readFileSync(path.resolve(promptFile), 'utf-8').trim(),
  };
}
