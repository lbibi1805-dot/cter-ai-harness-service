export interface CaptureKeys {
  /** CAPTURE_API_KEY: read/delete key for receiver backends only (uploads are public). Unset = module disabled. */
  apiKey?: string;
  /** ADMIN_TOKEN (monitoring UI) — read/delete access. */
  adminToken?: string;
}
