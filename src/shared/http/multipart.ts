import formidable from 'formidable';
import * as fs from 'fs';
import type { IncomingMessage } from 'http';
import { MultipartPayload, UploadedTextFile } from './interfaces/multipart.interface';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_TOTAL_BYTES } from './constants/multipart.constants';

/**
 * Parses a multipart body and reads every uploaded file as UTF-8 text.
 *
 * Files are returned in the order their parts appear in the request, so they
 * line up with per-file fields sent in the same order (`path`). formidable
 * itself lists files in the order they finished writing to disk, which can
 * differ when several files are uploaded at once.
 */
export async function parseMultipart(req: IncomingMessage): Promise<MultipartPayload> {
  // Empty files are allowed here so one empty file does not reject the whole batch;
  // the use case reports it per file. Total size is capped separately from one file.
  const form = formidable({
    multiples: true,
    maxFileSize: MAX_UPLOAD_FILE_BYTES,
    maxTotalFileSize: MAX_UPLOAD_TOTAL_BYTES,
    allowEmptyFiles: true,
    minFileSize: 0,
  });
  const partOrder = new Map<string, number>();
  form.on('fileBegin', (_name, file) => {
    partOrder.set(file.newFilename, partOrder.size);
  });
  const [rawFields, rawFiles] = await form.parse(req);

  const fields: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(rawFields)) fields[key] = values ?? [];

  const parts = Object.values(rawFiles)
    .flatMap((group) => group ?? [])
    .sort((a, b) => (partOrder.get(a.newFilename) ?? 0) - (partOrder.get(b.newFilename) ?? 0));
  const files: UploadedTextFile[] = [];
  for (const file of parts) {
    files.push({
      originalName: file.originalFilename ?? file.newFilename,
      content: await fs.promises.readFile(file.filepath, 'utf-8'),
    });
  }
  return { fields, files };
}
