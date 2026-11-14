import { MODEL_OUTPUT_LIMITS } from '../constants/modelOutputLimits.constants';
import type { ModelOutputLimit } from '../interfaces/modelOutputLimit.interface';

/** The output cap actually sent for `model`: `requested` clamped to the model's known limit (08 Bước 2). */
export function clampOutputTokens(model: string, requested: number, streaming: boolean, limits: readonly ModelOutputLimit[] = MODEL_OUTPUT_LIMITS): number {
  const limit = limits.find((entry) => entry.pattern.test(model) && (!entry.nonStreamingOnly || !streaming));
  return limit ? Math.min(requested, limit.maxOutputTokens) : requested;
}
