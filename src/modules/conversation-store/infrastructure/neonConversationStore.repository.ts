import { SchemaGuard } from '../../../shared/database/database';
import type { SqlClient, SqlStatement } from '../../../shared/database/interfaces/sqlClient.interface';
import { ValidationError } from '../../../shared/errors';
import { ConversationStateKey } from '../domain/enums/conversation.enums';
import type { ConversationStore } from '../domain/conversationStore.port';
import type {
  ArtifactEnrichment,
  ConversationDetail,
  ConversationListItem,
  ConversationSnapshot,
  PendingWorkflow,
  TurnWrite,
} from '../domain/interfaces/conversation.interface';
import { CONVERSATION_SCHEMA_STATEMENTS } from './constants/conversationSchema.constants';
import {
  parseJson,
  toArtifactDetail,
  toIso,
  toIsoOrNull,
  toMessageDetail,
  toStoredArtifact,
  toStoredMessage,
} from './helpers/conversationRow.helper';

type Row = Record<string, unknown>;

const STATE_KEYS = new Set<string>(Object.values(ConversationStateKey));

function stateKey(key: string): string {
  if (!STATE_KEYS.has(key)) throw new ValidationError(`Unknown conversation state key: ${key}`);
  return key;
}

/** Conversations in Postgres (Neon in prod). One round-trip per method; a turn's writes are one transaction. */
export class NeonConversationStore implements ConversationStore {
  private readonly schema: SchemaGuard;

  constructor(private readonly sql: SqlClient) {
    this.schema = new SchemaGuard(sql, CONVERSATION_SCHEMA_STATEMENTS);
  }

  async load(id: string, maxMessages: number, maxArtifacts: number): Promise<ConversationSnapshot | null> {
    const [row] = await this.query<Row>(
      `SELECT c.id, c.title, c.summary, c.summary_upto_seq, c.state, c.deleted_at,
         (SELECT COALESCE(MAX(seq), 0) FROM messages WHERE conversation_id = c.id) AS last_seq,
         (SELECT COUNT(*)::int FROM artifacts WHERE conversation_id = c.id) AS artifact_count,
         COALESCE((SELECT json_agg(x ORDER BY x.seq) FROM (
           SELECT m.id, m.seq, m.role, m.kind, m.text FROM messages m
           WHERE m.conversation_id = c.id AND m.seq > c.summary_upto_seq
           ORDER BY m.seq DESC LIMIT $2) x), '[]'::json) AS messages,
         COALESCE((SELECT json_agg(y ORDER BY y.ordinal) FROM (
           SELECT a.id, a.ordinal, a.kind, a.message_id, m.seq AS message_seq, a.object_key, a.mime, a.caption, a.ocr_text, a.data_json
           FROM artifacts a LEFT JOIN messages m ON m.id = a.message_id
           WHERE a.conversation_id = c.id ORDER BY a.ordinal DESC LIMIT $3) y), '[]'::json) AS artifacts
       FROM conversations c WHERE c.id = $1::uuid`,
      [id, maxMessages, maxArtifacts],
    );
    if (!row) return null;
    return {
      id: String(row.id),
      title: (row.title as string | null) ?? null,
      summary: (row.summary as string | null) ?? null,
      summaryUptoSeq: Number(row.summary_upto_seq ?? 0),
      state: parseJson<Record<string, unknown>>(row.state, {}),
      deletedAt: toIsoOrNull(row.deleted_at),
      lastSeq: Number(row.last_seq ?? 0),
      messages: parseJson<Row[]>(row.messages, []).map(toStoredMessage),
      artifacts: parseJson<Row[]>(row.artifacts, []).map(toStoredArtifact),
      artifactCount: Number(row.artifact_count ?? 0),
    };
  }

  async recordTurn(turn: TurnWrite): Promise<void> {
    const statements: SqlStatement[] = [
      {
        text: `INSERT INTO conversations (id, title) VALUES ($1::uuid, $2)
               ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
        params: [turn.conversationId, turn.title],
      },
    ];
    if (turn.messages.length > 0) {
      statements.push({
        text: `INSERT INTO messages (id, conversation_id, seq, role, kind, text, provider, model, mode, prompt_version,
                 tokens_in, tokens_out, ttft_ms, latency_ms, sources)
               SELECT r.id, $1::uuid, base.s + r.idx, r.role, r.kind, r.text, r.provider, r.model, r.mode, r.prompt_version,
                 r.tokens_in, r.tokens_out, r.ttft_ms, r.latency_ms, r.sources
               FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, idx int, role text, kind text, text text, provider text, model text,
                 mode text, prompt_version text, tokens_in int, tokens_out int, ttft_ms int, latency_ms int, sources jsonb)
               CROSS JOIN (SELECT COALESCE(MAX(seq), 0) AS s FROM messages WHERE conversation_id = $1::uuid) base`,
        params: [turn.conversationId, JSON.stringify(turn.messages.map((m, i) => ({
          id: m.id, idx: i + 1, role: m.role, kind: m.kind, text: m.text,
          provider: m.provider ?? null, model: m.model ?? null, mode: m.mode ?? null, prompt_version: m.promptVersion ?? null,
          tokens_in: m.tokensIn ?? null, tokens_out: m.tokensOut ?? null, ttft_ms: m.ttftMs ?? null, latency_ms: m.latencyMs ?? null,
          sources: m.sources ?? null,
        })))],
      });
    }
    if (turn.artifacts.length > 0) {
      statements.push({
        text: `INSERT INTO artifacts (id, conversation_id, message_id, ordinal, kind, object_key, mime, sha256, size_bytes, caption, ocr_text, data_json)
               SELECT r.id, $1::uuid, r.message_id, base.o + r.idx, r.kind, r.object_key, r.mime, r.sha256, r.size_bytes, r.caption, r.ocr_text, r.data_json
               FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, idx int, message_id uuid, kind text, object_key text, mime text, sha256 text,
                 size_bytes bigint, caption text, ocr_text text, data_json jsonb)
               CROSS JOIN (SELECT COALESCE(MAX(ordinal), 0) AS o FROM artifacts WHERE conversation_id = $1::uuid) base`,
        params: [turn.conversationId, JSON.stringify(turn.artifacts.map((a, i) => ({
          id: a.id, idx: i + 1, message_id: a.messageId, kind: a.kind, object_key: a.objectKey ?? null, mime: a.mime ?? null,
          sha256: a.sha256 ?? null, size_bytes: a.sizeBytes ?? null, caption: a.caption ?? null, ocr_text: a.ocrText ?? null,
          data_json: a.dataJson ?? null,
        })))],
      });
    }
    if (turn.state) {
      const set: Record<string, unknown> = {};
      const remove: string[] = [];
      for (const [key, value] of Object.entries(turn.state)) {
        stateKey(key);
        if (value === null) remove.push(key);
        else set[key] = value;
      }
      statements.push({
        text: 'UPDATE conversations SET state = (state || $2::jsonb) - $3::text[] WHERE id = $1::uuid',
        params: [turn.conversationId, JSON.stringify(set), remove],
      });
    }
    await this.transaction(statements);
  }

  async findActive(id: string, maxMessages: number): Promise<ConversationDetail | null> {
    const [row] = await this.query<Row>(
      `SELECT c.id, c.title, c.summary, c.summary_upto_seq, c.created_at, c.updated_at, c.deleted_at, c.purge_after,
         COALESCE((SELECT json_agg(x ORDER BY x.seq) FROM (
           SELECT * FROM messages WHERE conversation_id = c.id ORDER BY seq DESC LIMIT $2) x), '[]'::json) AS messages,
         COALESCE((SELECT json_agg(y ORDER BY y.ordinal) FROM (
           SELECT a.*, m.seq AS message_seq FROM artifacts a LEFT JOIN messages m ON m.id = a.message_id
           WHERE a.conversation_id = c.id) y), '[]'::json) AS artifacts
       FROM conversations c WHERE c.id = $1::uuid AND c.deleted_at IS NULL`,
      [id, maxMessages],
    );
    if (!row) return null;
    return {
      id: String(row.id),
      title: (row.title as string | null) ?? null,
      summary: (row.summary as string | null) ?? null,
      summaryUptoSeq: Number(row.summary_upto_seq ?? 0),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: null,
      purgeAfter: null,
      messages: parseJson<Row[]>(row.messages, []).map(toMessageDetail),
      artifacts: parseJson<Row[]>(row.artifacts, []).map(toArtifactDetail),
    };
  }

  async list(limit: number, deleted: boolean): Promise<ConversationListItem[]> {
    const rows = await this.query<Row>(
      `SELECT id, title, updated_at, deleted_at, purge_after FROM conversations
       WHERE ${deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'}
       ORDER BY updated_at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      id: String(r.id),
      title: (r.title as string | null) ?? null,
      updatedAt: toIso(r.updated_at),
      deletedAt: toIsoOrNull(r.deleted_at),
      purgeAfter: toIsoOrNull(r.purge_after),
    }));
  }

  async softDelete(id: string, purgeAfterDays: number): Promise<boolean> {
    const rows = await this.query(
      `UPDATE conversations SET deleted_at = COALESCE(deleted_at, now()),
         purge_after = COALESCE(purge_after, now() + make_interval(days => $2::int))
       WHERE id = $1::uuid RETURNING id`,
      [id, purgeAfterDays],
    );
    return rows.length > 0;
  }

  async restore(id: string): Promise<boolean> {
    const rows = await this.query('UPDATE conversations SET deleted_at = NULL, purge_after = NULL, updated_at = now() WHERE id = $1::uuid RETURNING id', [id]);
    return rows.length > 0;
  }

  async findPurgeable(limit: number): Promise<string[]> {
    const rows = await this.query<{ id: string }>(
      'SELECT id FROM conversations WHERE deleted_at IS NOT NULL AND purge_after <= now() ORDER BY purge_after LIMIT $1',
      [limit],
    );
    return rows.map((r) => String(r.id));
  }

  async deleteRows(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await this.query('DELETE FROM conversations WHERE id = ANY($1::uuid[]) RETURNING id', [ids]);
    return rows.length;
  }

  async enrichArtifacts(updates: ArtifactEnrichment[]): Promise<void> {
    if (updates.length === 0) return;
    await this.query(
      `UPDATE artifacts a SET caption = r.caption, ocr_text = r.ocr_text
       FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, caption text, ocr_text text) WHERE a.id = r.id`,
      [JSON.stringify(updates.map((u) => ({ id: u.id, caption: u.caption, ocr_text: u.ocrText })))],
    );
  }

  async saveSummary(id: string, summary: string, uptoSeq: number, expectedUptoSeq: number): Promise<boolean> {
    const rows = await this.query(
      'UPDATE conversations SET summary = $2, summary_upto_seq = $3 WHERE id = $1::uuid AND summary_upto_seq = $4 RETURNING id',
      [id, summary, uptoSeq, expectedUptoSeq],
    );
    return rows.length > 0;
  }

  async setState(id: string, key: string, value: Record<string, unknown> | null, title: string): Promise<void> {
    const k = stateKey(key);
    await this.query(
      value === null
        ? `INSERT INTO conversations (id, title) VALUES ($1::uuid, $3) ON CONFLICT (id) DO UPDATE SET state = conversations.state - $2::text`
        : `INSERT INTO conversations (id, title, state) VALUES ($1::uuid, $3, jsonb_build_object($2::text, $4::jsonb))
           ON CONFLICT (id) DO UPDATE SET state = conversations.state || jsonb_build_object($2::text, $4::jsonb), updated_at = now()`,
      value === null ? [id, k, title] : [id, k, title, JSON.stringify(value)],
    );
  }

  async takeStateById(key: string, valueId: string): Promise<PendingWorkflow | null> {
    const k = stateKey(key);
    const [row] = await this.query<Row>(
      `WITH target AS (
         SELECT id, state->'${k}' AS pending FROM conversations
         WHERE state->'${k}'->>'id' = $1 AND deleted_at IS NULL
         FOR UPDATE)
       UPDATE conversations c SET state = c.state - '${k}', updated_at = now()
       FROM target WHERE c.id = target.id
       RETURNING c.id, target.pending`,
      [valueId],
    );
    if (!row) return null;
    return { conversationId: String(row.id), value: parseJson<Record<string, unknown>>(row.pending, {}) };
  }

  private async query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    await this.schema.ensure();
    return this.sql.query<T>(text, params);
  }

  private async transaction(statements: SqlStatement[]): Promise<void> {
    await this.schema.ensure();
    await this.sql.transaction(statements);
  }
}
