export interface AuxTimeouts {
  /** Caption/OCR of one image in the background. */
  imageNoteMs: number;
  /** Caption/OCR before answering an image-only question (on the critical path). */
  imageNoteSyncMs: number;
  rewriteMs: number;
  compactMs: number;
}
