import { SchemaGuard } from '../../../shared/database/database';
import type { SqlClient, SqlStatement } from '../../../shared/database/interfaces/sqlClient.interface';
import { ValidationError } from '../../../shared/errors';
import { ConversationStateKey } from '../domain/enums/conversation.enums';
import type { ConversationStore } from '../domain/conversationStore.port';
import type {
  ArtifactDetail,
  ArtifactEnrichment,
  ConversationDetail,
  ConversationListPage,
  ConversationListQuery,
  ConversationSnapshot,
  MessagePage,
  PendingWorkflow,
  PinnedArtifactsOptions,
  RenamedConversation,
  TurnWrite,
} from '../domain/interfaces/conversation.interface';
import { CONVERSATION_SCHEMA_STATEMENTS } from './constants/conversationSchema.constants';
import {
  pageOfMessages,
  parseJson,
  titleSourceOf,
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

  async load(id: string, maxMessages: number, maxArtifacts: number, pinned?: PinnedArtifactsOptions): Promise<ConversationSnapshot | null> {
    // Newest N artifacts + pinned design kinds (outside the N window), in the same single query.
    const [row] = await this.query<Row>(
      `SELECT c.id, c.title, c.summary, c.summary_upto_seq, c.state, c.deleted_at,
         (SELECT COALESCE(MAX(seq), 0) FROM messages WHERE conversation_id = c.id) AS last_seq,
         (SELECT COUNT(*)::int FROM artifacts WHERE conversation_id = c.id) AS artifact_count,
         COALESCE((SELECT json_agg(x ORDER BY x.seq) FROM (
           SELECT m.id, m.seq, m.role, m.kind, m.text FROM messages m
           WHERE m.conversation_id = c.id AND m.seq > c.summary_upto_seq
           ORDER BY m.seq DESC LIMIT $2) x), '[]'::json) AS messages,
         COALESCE((SELECT json_agg(y ORDER BY y.ordinal) FROM (
           SELECT a.id, a.ordinal, a.kind, a.message_id, m.seq AS message_seq, a.object_key, a.mime, a.caption, a.ocr_text, a.data_json,
             a.label, a.level, a.owner, a.parent_artifact_id, a.version
           FROM artifacts a LEFT JOIN messages m ON m.id = a.message_id
           WHERE a.id IN (
             (SELECT n.id FROM artifacts n WHERE n.conversation_id = c.id ORDER BY n.ordinal DESC LIMIT $3)
             UNION
             (SELECT p.id FROM artifacts p WHERE p.conversation_id = c.id AND p.kind = ANY($4::text[]) ORDER BY p.ordinal DESC LIMIT $5))
           ) y), '[]'::json) AS artifacts
       FROM conversations c WHERE c.id = $1::uuid`,
      [id, maxMessages, maxArtifacts, [...(pinned?.kinds ?? [])], pinned?.max ?? 0],
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
                 tokens_in, tokens_out, tokens_cached, ttft_ms, latency_ms, sources, resolved_refs, intent, intent_confidence)
               SELECT r.id, $1::uuid, base.s + r.idx, r.role, r.kind, r.text, r.provider, r.model, r.mode, r.prompt_version,
                 r.tokens_in, r.tokens_out, r.tokens_cached, r.ttft_ms, r.latency_ms, r.sources, r.resolved_refs, r.intent, r.intent_confidence
               FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, idx int, role text, kind text, text text, provider text, model text,
                 mode text, prompt_version text, tokens_in int, tokens_out int, tokens_cached int, ttft_ms int, latency_ms int,
                 sources jsonb, resolved_refs jsonb, intent text, intent_confidence real)
               CROSS JOIN (SELECT COALESCE(MAX(seq), 0) AS s FROM messages WHERE conversation_id = $1::uuid) base`,
        params: [turn.conversationId, JSON.stringify(turn.messages.map((m, i) => ({
          id: m.id, idx: i + 1, role: m.role, kind: m.kind, text: m.text,
          provider: m.provider ?? null, model: m.model ?? null, mode: m.mode ?? null, prompt_version: m.promptVersion ?? null,
          tokens_in: m.tokensIn ?? null, tokens_out: m.tokensOut ?? null, tokens_cached: m.tokensCached ?? null,
          ttft_ms: m.ttftMs ?? null, latency_ms: m.latencyMs ?? null, sources: m.sources ?? null, resolved_refs: m.resolvedRefs ?? null,
          intent: m.intent ?? null, intent_confidence: m.intentConfidence ?? null,
        })))],
      });
    }
    if (turn.artifacts.length > 0) {
      statements.push({
        text: `INSERT INTO artifacts (id, conversation_id, message_id, ordinal, kind, object_key, mime, sha256, size_bytes, caption, ocr_text, data_json,
                 label, level, owner, parent_artifact_id, version)
               SELECT r.id, $1::uuid, r.message_id, base.o + r.idx, r.kind, r.object_key, r.mime, r.sha256, r.size_bytes, r.caption, r.ocr_text, r.data_json,
                 r.label, r.level, r.owner, r.parent_artifact_id, COALESCE(r.version, 1)
               FROM jsonb_to_recordset($2::jsonb) AS r(id uuid, idx int, message_id uuid, kind text, object_key text, mime text, sha256 text,
                 size_bytes bigint, caption text, ocr_text text, data_json jsonb, label text, level text, owner text, parent_artifact_id uuid, version int)
               CROSS JOIN (SELECT COALESCE(MAX(ordinal), 0) AS o FROM artifacts WHERE conversation_id = $1::uuid) base`,
        params: [turn.conversationId, JSON.stringify(turn.artifacts.map((a, i) => ({
          id: a.id, idx: i + 1, message_id: a.messageId, kind: a.kind, object_key: a.objectKey ?? null, mime: a.mime ?? null,
          sha256: a.sha256 ?? null, size_bytes: a.sizeBytes ?? null, caption: a.caption ?? null, ocr_text: a.ocrText ?? null,
          data_json: a.dataJson ?? null, label: a.label ?? null, level: a.level ?? null, owner: a.owner ?? null,
          parent_artifact_id: a.parentArtifactId ?? null, version: a.version ?? null,
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
    // LIMIT n + 1: the extra (oldest) row only tells whether older messages exist.
    const [row] = await this.query<Row>(
      `SELECT c.id, COALESCE(c.display_title, c.title) AS title, c.display_title IS NOT NULL AS user_titled,
         c.summary, c.summary_upto_seq, c.state, c.created_at, c.updated_at, c.deleted_at, c.purge_after,
         COALESCE((SELECT json_agg(x ORDER BY x.seq) FROM (
           SELECT * FROM messages WHERE conversation_id = c.id ORDER BY seq DESC LIMIT $2::int + 1) x), '[]'::json) AS messages,
         COALESCE((SELECT json_agg(y ORDER BY y.ordinal) FROM (
           SELECT a.*, m.seq AS message_seq FROM artifacts a LEFT JOIN messages m ON m.id = a.message_id
           WHERE a.conversation_id = c.id) y), '[]'::json) AS artifacts
       FROM conversations c WHERE c.id = $1::uuid AND c.deleted_at IS NULL`,
      [id, maxMessages],
    );
    if (!row) return null;
    const state = parseJson<Record<string, unknown>>(row.state, {});
    return {
      id: String(row.id),
      title: (row.title as string | null) ?? null,
      titleSource: titleSourceOf(row.user_titled),
      summary: (row.summary as string | null) ?? null,
      summaryUptoSeq: Number(row.summary_upto_seq ?? 0),
      state,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      deletedAt: null,
      purgeAfter: null,
      pending: Object.keys(state),
      ...pageOfMessages(parseJson<Row[]>(row.messages, []).map(toMessageDetail), maxMessages),
      artifacts: parseJson<Row[]>(row.artifacts, []).map(toArtifactDetail),
    };
  }

  async findMessages(id: string, beforeSeq: number | null, limit: number): Promise<MessagePage | null> {
    // One round-trip: the page (limit + 1 rows) and the artifacts of the returned messages only.
    const [row] = await this.query<Row>(
      `WITH conv AS (SELECT id FROM conversations WHERE id = $1::uuid AND deleted_at IS NULL),
       page AS (
         SELECT m.* FROM messages m JOIN conv ON m.conversation_id = conv.id
         WHERE ($2::int IS NULL OR m.seq < $2::int)
         ORDER BY m.seq DESC LIMIT $3::int + 1),
       shown AS (SELECT id, seq FROM page ORDER BY seq DESC LIMIT $3::int)
       SELECT conv.id,
         COALESCE((SELECT json_agg(p ORDER BY p.seq) FROM page p), '[]'::json) AS messages,
         COALESCE((SELECT json_agg(y ORDER BY y.ordinal) FROM (
           SELECT a.*, s.seq AS message_seq FROM artifacts a JOIN shown s ON s.id = a.message_id
           WHERE a.conversation_id = conv.id) y), '[]'::json) AS artifacts
       FROM conv`,
      [id, beforeSeq, limit],
    );
    if (!row) return null;
    return {
      ...pageOfMessages(parseJson<Row[]>(row.messages, []).map(toMessageDetail), limit),
      artifacts: parseJson<Row[]>(row.artifacts, []).map(toArtifactDetail),
    };
  }

  async findActiveArtifact(conversationId: string, artifactId: string): Promise<ArtifactDetail | null> {
    // Light lookup for the bytes route: one row, no messages (was a full findActive per image).
    const [row] = await this.query<Row>(
      `SELECT a.* FROM artifacts a JOIN conversations c ON c.id = a.conversation_id
       WHERE a.id = $2::uuid AND c.id = $1::uuid AND c.deleted_at IS NULL`,
      [conversationId, artifactId],
    );
    return row ? toArtifactDetail(row) : null;
  }

  async list(query: ConversationListQuery): Promise<ConversationListPage> {
    const params: unknown[] = [query.limit + 1];
    const where = [query.deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
    if (query.pending) {
      params.push(stateKey(query.pending));
      where.push(`state ? $${params.length}`);
    }
    if (query.after) {
      params.push(query.after.updatedAt, query.after.id);
      where.push(`(updated_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }
    // Cursor text comes from SQL (microseconds, UTC, independent of DateStyle/TimeZone): a JS Date would drop the µs.
    const rows = await this.query<Row>(
      `SELECT id, COALESCE(display_title, title) AS title, display_title IS NOT NULL AS user_titled,
         updated_at, to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
         deleted_at, purge_after, ARRAY(SELECT jsonb_object_keys(state)) AS pending FROM conversations
       WHERE ${where.join(' AND ')}
       ORDER BY updated_at DESC, id DESC LIMIT $1`,
      params,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      conversations: page.map((r) => ({
        id: String(r.id),
        title: (r.title as string | null) ?? null,
        titleSource: titleSourceOf(r.user_titled),
        updatedAt: toIso(r.updated_at),
        deletedAt: toIsoOrNull(r.deleted_at),
        purgeAfter: toIsoOrNull(r.purge_after),
        pending: Array.isArray(r.pending) ? r.pending.map(String) : [],
      })),
      next: rows.length > query.limit && last ? { updatedAt: String(last.cursor_at), id: String(last.id) } : null,
    };
  }

  async rename(id: string, displayTitle: string | null): Promise<RenamedConversation | null> {
    // Deliberately leaves updated_at alone: a rename must not move the conversation to the top of the list.
    const [row] = await this.query<Row>(
      `UPDATE conversations SET display_title = $2 WHERE id = $1::uuid AND deleted_at IS NULL
       RETURNING id, COALESCE(display_title, title) AS title, display_title IS NOT NULL AS user_titled`,
      [id, displayTitle],
    );
    if (!row) return null;
    return { id: String(row.id), title: (row.title as string | null) ?? null, titleSource: titleSourceOf(row.user_titled) };
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
      `UPDATE artifacts a SET caption = COALESCE(r.caption, a.caption), ocr_text = COALESCE(r.ocr_text, a.ocr_text),
         data_json = COALESCE(r.data_json, a.data_json), label = COALESCE(r.label, a.label)
       FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, caption text, ocr_text text, data_json jsonb, label text) WHERE a.id = r.id`,
      [JSON.stringify(updates.map((u) => ({ id: u.id, caption: u.caption ?? null, ocr_text: u.ocrText ?? null, data_json: u.dataJson ?? null, label: u.label ?? null })))],
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
