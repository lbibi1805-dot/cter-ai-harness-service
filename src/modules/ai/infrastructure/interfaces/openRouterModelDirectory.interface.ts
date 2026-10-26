/** OpenRouter extends the OpenAI model object with the request parameters each model accepts. */
export interface OpenRouterModel {
  id: string;
  supported_parameters?: string[];
}
