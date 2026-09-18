/**
 * Pure model-chain builder — extracted per PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 0
 * step 4 and mục 4.C. Copied (not yet wired) from the duplicated
 * `PollOrchestrator.buildModelChain` / `ConversationPoller.buildModelChain` private
 * methods, which were ~100% identical.
 *
 * `core/*` must stay pure (mục 2.6 / mục 5): it does not import `config` or
 * `config/allowedModels` directly — the caller passes in `apiModeResolver` so this
 * module has no knowledge of *how* API mode is determined for a given provider/model.
 */

/** Returns a mode string when the caller's fallback filtering cares about it (today:
 * only the openai provider's 'chat-completions' | 'responses' distinction), or `null`
 * when the provider does not have match-by-mode semantics. */
export type ApiModeResolver<P extends string = string> = (provider: P, model: string) => string | null;

/**
 * Builds `[primaryModel, ...compatibleFallbacks]`, preserving the exact semantics of
 * the original duplicated implementations:
 * - primary model is always first, and always included even if also in the fallback list.
 * - a fallback is skipped if it equals the primary model or is already in the chain.
 * - a fallback is skipped when `provider === 'openai'` and its resolved API mode differs
 *   from the primary model's API mode (fallback filtering only applies to openai; see
 *   PLAN_MODULE_ARCHITECTURE.md FIX #13 — this was previously mis-described as
 *   "grok/openai").
 *
 * Generic over the provider type `P` so callers using a narrower type (e.g. the
 * `AIProviderName` union) can pass a resolver typed for that same union without a
 * cast — `buildModelChain('openai', ..., getModelApiMode)` infers `P = AIProviderName`.
 */
export function buildModelChain<P extends string = string>(
  provider: P,
  primaryModel: string,
  fallbackList: readonly string[],
  apiModeResolver: ApiModeResolver<P>,
): string[] {
  const chain: string[] = [primaryModel];
  const primaryMode = apiModeResolver(provider, primaryModel);
  for (const fb of fallbackList) {
    if (
      fb !== primaryModel &&
      !chain.includes(fb) &&
      ((provider as string) !== 'openai' || apiModeResolver(provider, fb) === primaryMode)
    ) {
      chain.push(fb);
    }
  }
  return chain;
}
