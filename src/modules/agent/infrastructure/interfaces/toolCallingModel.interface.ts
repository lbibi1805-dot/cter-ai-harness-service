import OpenAI from 'openai';
import { type Sleep } from '../../../../shared/resilience';
import { OpenRouterModelDirectory, type AiConfig } from '../../../ai';

export interface DirectToolModelOptions {
  apiKey: string;
  timeoutMs: number;
  /** Test hook: point the SDK at a fake OpenAI-compatible server. */
  baseURL?: string;
  sleep?: Sleep;
}

export interface OpenRouterToolModelOptions {
  client: OpenAI;
  config: AiConfig;
  sleep?: Sleep;
  /** Test hook; production asks OpenRouter's model listing. */
  directory?: Pick<OpenRouterModelDirectory, 'supportsTools'>;
}
