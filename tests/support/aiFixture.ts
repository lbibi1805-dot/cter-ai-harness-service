import { AIProvider, createAiModule, type AIAdapter, type AiConfig, type AiModule } from '../../src/modules/ai';
import { buildTestAiConfig, perProvider } from './configFixture';

/** OpenAI defaults to the agent-capable model, so `mode: agent` requests can run the tool loop. */
export const AGENT_TEST_AI_CONFIG: AiConfig = buildTestAiConfig({
  keys: { [AIProvider.OPENAI]: 'k' },
  defaultModels: perProvider((provider) => (provider === AIProvider.OPENAI ? 'gpt-6-astra' : `${provider}-test`)),
  maxRetryCount: 0,
});

/** The real AI module (catalog, fallback, prompts) with every provider served by one fake adapter. */
export function createFakeAiModule(process: AIAdapter['process'], aiConfig: AiConfig = AGENT_TEST_AI_CONFIG): AiModule {
  const adapter: AIAdapter = { validate: async () => undefined, process };
  return createAiModule(
    { ai: aiConfig, systemPrompt: 'sys', knowledgeContent: '' },
    { adapters: { direct: () => adapter, openRouter: () => null, credentialName: () => 'TEST_API_KEY' }, sleep: async () => undefined },
  );
}
