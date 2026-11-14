/** One row of MODEL_OUTPUT_LIMITS. */
export interface ModelOutputLimit {
  pattern: RegExp;
  maxOutputTokens: number;
  /** The limit applies to non-streamed requests only (streamed ones send the configured cap). */
  nonStreamingOnly?: boolean;
  /** True when confirmed from an SDK/doc in the repo; false = "chưa xác minh". */
  verified: boolean;
}
