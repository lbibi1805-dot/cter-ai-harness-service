import type { PartnerImageSource, StarlinguidePartnerClient } from '../application/interfaces/starlinguideForwarder.interface';

/** STARLINGUIDE_* settings (planning-15112026-starlinguide-push). Absent = feature off. */
export interface StarlinguideSettings {
  /** STARLINGUIDE_API_BASE_URL, no trailing slash. */
  baseUrl: string;
  /** STARLINGUIDE_PARTNER_SECRET — secret. */
  secret: string;
  /** STARLINGUIDE_EMAILS, 1–20, case kept. */
  emails: string[];
  flushDelayMs: number;
  timeoutMs: number;
}

export interface StarlinguideForwarderDeps {
  /** Reads photo bytes right before sending (the capture service). */
  images: PartnerImageSource;
  /** Test hooks. */
  client?: StarlinguidePartnerClient;
  now?: () => number;
}
