import type { PromptImage } from '../../../ai';

export interface AuxCall {
  system: string;
  text: string;
  images?: PromptImage[];
  label: string;
  timeoutMs: number;
}

/** A cheap model for side jobs (captions, OCR, summaries, query rewriting) — never the answering model. */
export interface AuxModel {
  readonly name: string;
  complete(call: AuxCall): Promise<string>;
}
