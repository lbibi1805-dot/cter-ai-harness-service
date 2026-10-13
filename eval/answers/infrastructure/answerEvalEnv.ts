import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'dotenv';
import { getModelApiMode } from '../../../src/config/allowedModels';
import { DEFAULT_RERANK_CONFIG, parseRerankProvider, type RerankConfig } from '../../../src/modules/rerank/domain';
import { DEFAULT_AGENT_BUDGET } from '../../../src/modules/agent/domain/agentBudget';
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
  /** Reranking as the service would run it (RERANK_* keys; off when absent). */
  rerank: RerankConfig;
  /** AGENT_MIN_TOOL_CALLS (service default when absent). */
  agentMinToolCalls: number;
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
  const int = (key: EvalEnvKey, fallback: number) => {
    const parsed = Number(value(key) ?? fallback);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  };

  return {
    ...base,
    openaiApiKey,
    databaseUrl,
    answerModel,
    judgeModel: value(EvalEnvKey.JUDGE_MODEL) ?? DEFAULT_JUDGE_MODEL,
    ragTopK: Number.isInteger(ragTopK) && ragTopK > 0 ? ragTopK : DEFAULT_RAG_TOP_K,
    systemPrompt: fs.readFileSync(path.resolve(promptFile), 'utf-8').trim(),
    rerank: {
      ...DEFAULT_RERANK_CONFIG,
      provider: parseRerankProvider(value(EvalEnvKey.RERANK_PROVIDER)),
      model: value(EvalEnvKey.RERANK_MODEL) ?? DEFAULT_RERANK_CONFIG.model,
      candidates: int(EvalEnvKey.RERANK_CANDIDATES, DEFAULT_RERANK_CONFIG.candidates),
      topN: int(EvalEnvKey.RERANK_TOP_N, DEFAULT_RERANK_CONFIG.topN),
    },
    agentMinToolCalls: int(EvalEnvKey.AGENT_MIN_TOOL_CALLS, DEFAULT_AGENT_BUDGET.minToolCalls),
  };
}
