export interface CaptureKeys {
  /** CAPTURE_API_KEY: shared with every receiver app. Unset = module disabled. */
  apiKey?: string;
  /** CAPTURE_UPLOAD_KEY: optional separate key for uploading/deleting; defaults to apiKey. */
  uploadKey?: string;
  /** ADMIN_TOKEN (monitoring UI) — full access. */
  adminToken?: string;
}
