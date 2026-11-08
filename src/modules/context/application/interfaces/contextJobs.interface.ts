export interface AuxTimeouts {
  /** Caption/OCR of one image in the background. */
  imageNoteMs: number;
  /** Caption/OCR before answering an image-only question (on the critical path). */
  imageNoteSyncMs: number;
  rewriteMs: number;
  compactMs: number;
  /** Design-note extraction in the background (defaults to `compactMs`). */
  designNoteMs?: number;
}

/** A design_note written by a turn, refined by the aux model afterwards. */
export interface DesignNoteJob {
  id: string;
  question: string;
  answer: string;
  version: number;
  turn: number | null;
}
