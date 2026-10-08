import * as fs from 'fs';
import type { IncomingMessage } from 'http';
import formidable from 'formidable';

export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

export interface UploadedTextFile {
  originalName: string;
  content: string;
}

export interface MultipartPayload {
  fields: Record<string, string[]>;
  files: UploadedTextFile[];
}

/** Parses a multipart body and reads every uploaded file as UTF-8 text. */
export async function parseMultipart(req: IncomingMessage): Promise<MultipartPayload> {
  const form = formidable({ multiples: true, maxFileSize: MAX_UPLOAD_FILE_BYTES });
  const [rawFields, rawFiles] = await form.parse(req);

  const fields: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(rawFields)) fields[key] = values ?? [];

  const files: UploadedTextFile[] = [];
  for (const group of Object.values(rawFiles)) {
    for (const file of group ?? []) {
      files.push({
        originalName: file.originalFilename ?? file.newFilename,
        content: await fs.promises.readFile(file.filepath, 'utf-8'),
      });
    }
  }
  return { fields, files };
}
