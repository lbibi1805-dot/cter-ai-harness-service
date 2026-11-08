import { DEFAULT_AI_LATENCY, DEFAULT_PROVIDER_TUNING } from '../constants/latency.constants';
import type { AiLatencySettings, ProviderTuning } from '../interfaces/latency.interface';

export function resolveLatencySettings(settings: Partial<AiLatencySettings> | undefined): AiLatencySettings {
  return { ...DEFAULT_AI_LATENCY, ...settings, circuit: { ...DEFAULT_AI_LATENCY.circuit, ...settings?.circuit } };
}

export function resolveProviderTuning(tuning: Partial<ProviderTuning> | undefined): ProviderTuning {
  return { ...DEFAULT_PROVIDER_TUNING, ...tuning };
}
