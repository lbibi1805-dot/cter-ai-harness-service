import type { RequestIntent } from '../../domain/enums/routing.enums';

/** One call to the cheap aux model (AUX_PROVIDER / AUX_MODEL). */
export interface RouterAuxCall {
  system: string;
  text: string;
  label: string;
  timeoutMs: number;
  /** Tiny: the answer is a one-line JSON object. */
  maxOutputTokens: number;
}

export interface RouterAuxModel {
  readonly name: string;
  complete(call: RouterAuxCall): Promise<string>;
}

/** The combined answer (note 05 §2 + 17 §3.3): intent and artifact refs from ONE call. */
export interface AuxRouteReply {
  /** Null when the model answered no valid intent. */
  intent: RequestIntent | null;
  confidence: number;
  /** Registry aliases ("A7"); ids not in the registry are already dropped. */
  refs: string[];
  reason?: string;
  /** The raw `essay` object (only asked for Essay Mode requests); validated by the essay module. */
  essay?: Record<string, unknown>;
}

/** The essay half of the combined answer (structurally the essay module's SharedEssayAnalysis). */
export interface AuxEssayBlock {
  /** True when the call itself failed (error / timeout): the caller may run its own analysis. */
  failed: boolean;
  /** The raw `essay` object; null when the model answered without a usable one. */
  block: Record<string, unknown> | null;
}

/** Prompt lookup (`prompts/skills/...`); null = the built-in constant. */
export type RouterSkillSource = (id: string) => string | null;

/** What the request looks like, beyond the registry (helps the intent half of the answer). */
export interface AuxRouteHints {
  slash: boolean;
  imageCount: number;
  designCount: number;
  /** Essay Mode: also ask for the `essay` analysis block (larger output cap). */
  essay?: boolean;
}

export interface RoutingSettings {
  /** ARTIFACT_RESOLVER_AUX_TIMEOUT_MS: one budget for the combined call. */
  timeoutMs: number;
  /** Prompt registry lookup for the essay block instructions; absent = the constant. */
  skills?: RouterSkillSource | null;
}
