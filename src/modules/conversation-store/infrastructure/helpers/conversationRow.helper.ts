import { ArtifactKind, MessageKind, MessageRole } from '../../domain/enums/conversation.enums';
import type { ArtifactDetail, MessageDetail, StoredArtifact, StoredMessage } from '../../domain/interfaces/conversation.interface';

type Row = Record<string, unknown>;

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  return '';
}

export function toIsoOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function strOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** JSON columns come back parsed from Neon/PGlite, but stay robust to strings. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function toStoredMessage(row: Row): StoredMessage {
  return {
    id: String(row.id),
    seq: Number(row.seq),
    role: row.role as MessageRole,
    kind: (row.kind as MessageKind) ?? MessageKind.CHAT,
    text: String(row.text ?? ''),
  };
}

export function toMessageDetail(row: Row): MessageDetail {
  return {
    ...toStoredMessage(row),
    provider: strOrNull(row.provider),
    model: strOrNull(row.model),
    mode: strOrNull(row.mode),
    promptVersion: strOrNull(row.prompt_version),
    tokensIn: numOrNull(row.tokens_in),
    tokensOut: numOrNull(row.tokens_out),
    ttftMs: numOrNull(row.ttft_ms),
    latencyMs: numOrNull(row.latency_ms),
    sources: parseJson(row.sources, null),
    createdAt: toIso(row.created_at),
  };
}

export function toStoredArtifact(row: Row): StoredArtifact {
  return {
    id: String(row.id),
    ordinal: Number(row.ordinal ?? 0),
    kind: row.kind as ArtifactKind,
    messageId: strOrNull(row.message_id),
    messageSeq: numOrNull(row.message_seq),
    objectKey: strOrNull(row.object_key),
    mime: strOrNull(row.mime),
    caption: strOrNull(row.caption),
    ocrText: strOrNull(row.ocr_text),
    dataJson: parseJson(row.data_json, null),
  };
}

export function toArtifactDetail(row: Row): ArtifactDetail {
  return { ...toStoredArtifact(row), sha256: strOrNull(row.sha256), sizeBytes: numOrNull(row.size_bytes), createdAt: toIso(row.created_at) };
}
