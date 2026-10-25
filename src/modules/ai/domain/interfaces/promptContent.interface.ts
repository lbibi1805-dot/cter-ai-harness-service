export interface PromptImage {
  data: Buffer;
  mimeType: string;
}

/** What the user asked: extracted file text, a chat question, plus any images. */
export interface PromptContent {
  textContent: string;
  imageBuffers: PromptImage[];
}
