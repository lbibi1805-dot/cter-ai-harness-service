import { ArtifactKind, MessageKind, MessageRole, TitleSource } from '../../domain/enums/conversation.enums';
import type { ArtifactDetail, MessageDetail, ResolvedRefs, StoredArtifact, StoredMessage } from '../../domain/interfaces/conversation.interface';

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
    tokensCached: numOrNull(row.tokens_cached),
    ttftMs: numOrNull(row.ttft_ms),
    latencyMs: numOrNull(row.latency_ms),
    sources: parseJson(row.sources, null),
    resolvedRefs: parseJson<ResolvedRefs | null>(row.resolved_refs, null),
    intent: strOrNull(row.intent),
    intentConfidence: numOrNull(row.intent_confidence),
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
    label: strOrNull(row.label),
    level: strOrNull(row.level),
    owner: (strOrNull(row.owner) as MessageRole | null),
    parentArtifactId: strOrNull(row.parent_artifact_id),
    version: Number(row.version ?? 1),
  };
}

export function toArtifactDetail(row: Row): ArtifactDetail {
  return { ...toStoredArtifact(row), sha256: strOrNull(row.sha256), sizeBytes: numOrNull(row.size_bytes), createdAt: toIso(row.created_at) };
}

export function titleSourceOf(userTitled: unknown): TitleSource {
  return userTitled === true || userTitled === 't' ? TitleSource.USER : TitleSource.AUTO;
}

/**
 * Messages read with `LIMIT n + 1` (any order): the extra oldest row only says that more exist.
 * Same rule for the SQL and the in-memory store. Returned oldest first.
 */
export function pageOfMessages<T extends { seq: number }>(rows: T[], limit: number): { messages: T[]; hasMoreMessages: boolean; oldestSeq: number | null } {
  const sorted = [...rows].sort((a, b) => a.seq - b.seq);
  const hasMoreMessages = sorted.length > limit;
  const messages = hasMoreMessages ? sorted.slice(sorted.length - limit) : sorted;
  return { messages, hasMoreMessages, oldestSeq: messages[0]?.seq ?? null };
}
