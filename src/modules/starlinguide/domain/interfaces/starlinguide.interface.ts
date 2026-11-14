/** A capture photo waiting to be sent (metadata only; bytes are read from storage right before sending). */
export interface PartnerImageRef {
  folder: string;
  index: number;
  seq: number;
  /** Name inside the capture batch, e.g. `03-a1b2c3.jpg`. */
  name: string;
  mimeType: string;
  bytes: number;
}

/** One entry of `results[]`. */
export interface PartnerResult {
  email: string;
  name: string;
  file?: { id: number; name: string };
  error?: { code: string; message: string };
}

/** One file part of the multipart request. */
export interface PartnerFile {
  fileName: string;
  mimeType: string;
  body: Buffer;
}
