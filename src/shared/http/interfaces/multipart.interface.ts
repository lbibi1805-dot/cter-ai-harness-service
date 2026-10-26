export interface UploadedTextFile {
  originalName: string;
  content: string;
}

export interface MultipartPayload {
  fields: Record<string, string[]>;
  files: UploadedTextFile[];
}
