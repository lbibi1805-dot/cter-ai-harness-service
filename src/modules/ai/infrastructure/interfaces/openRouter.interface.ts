/**
 * Body fields OpenRouter adds on top of the OpenAI Chat Completions schema.
 * `models` is the server-side fallback list, tried in order.
 */
export interface OpenRouterRoutingFields {
  models?: string[];
  provider?: { sort?: string; allow_fallbacks: boolean };
}

/** OpenRouter can answer HTTP 200 with an `error` object and no choices. */
export interface OpenRouterErrorBody {
  error?: { code?: number; message?: string };
}
