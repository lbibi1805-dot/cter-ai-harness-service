# `src/modules/*/domain (module-owned types)` classification (Phase 0, PLAN_MODULE_ARCHITECTURE.md mục 3.1 / mục 6 Phase 0 step 3)

Reviewed **before** any file move (Phase 1+). Each type in the current `src/modules/*/domain (module-owned types)`
monolith is assigned to exactly one of the 3 destinations described in mục 3.1:

1. **Composition/config contract** — not runtime module boundary data, lives in `config/`.
2. **Shared primitive used by ≥3 unrelated modules** — `core/` (type-only, no logic) or `shared/`.
3. **DTO/port owned by exactly one domain** — moves into that module's `dto.ts` / `ports.ts`.

| Type | Current location | Destination | Group | Rationale |
|---|---|---|---|---|
| `AIProviderName` | `types.ts` | `core/shared/aiProvider.ts` | (2) shared primitive | Used across `ai`, `canvas`, `files`, `conversations` — not owned by one domain. |
| `CanvasAccountConfig` | `types.ts` | `config/index.ts` | (1) config | Composition-root shape (env-driven account list), not a runtime module boundary DTO. |
| `AppConfig` | `types.ts` | `config/index.ts` | (1) config | Top-level composition config assembled once at startup. |
| `FileStatus` | `types.ts` | `modules/files/dto.ts` | (3) module DTO | Q/A file processing state, owned by `files`. |
| `ParsedFileName` | `types.ts` | `modules/files/dto.ts` | (3) module DTO | Q/A file naming convention, owned by `files`. |
| `FileContent` | `types.ts` | `modules/files/dto.ts` | (3) module DTO | Extracted file payload passed into AI invocation; owned by `files` (consumed by `ai` via `ports.ts` reference). |
| `ProcessingRecord` | `types.ts` | `modules/files/dto.ts` | (3) module DTO | File processing/retry state, owned by `files`. |
| `CanvasFolder` | `types.ts` | `modules/canvas/dto.ts` | (3) module DTO | Canvas API entity. |
| `CanvasFile` | `types.ts` | `modules/canvas/dto.ts` | (3) module DTO | Canvas API entity. |
| `AIAdapter` | `types.ts` | `modules/ai/ports.ts` | (3) module port | Interface a module needs but doesn't implement (implemented by each provider adapter). |
| `ConversationAttachment` | `types.ts` | `modules/conversations/dto.ts` | (3) module DTO | Conversation domain entity. |
| `ConversationMessage` | `types.ts` | `modules/conversations/dto.ts` | (3) module DTO | Conversation domain entity. |
| `ConversationReplyStatus` | `types.ts` | `modules/conversations/dto.ts` | (3) module DTO | Conversation domain entity. |
| `ParsedConversationRequest` | `types.ts` | `modules/conversations/dto.ts` | (3) module DTO | Conversation domain entity. |
| `ConversationReply` | `types.ts` | `modules/conversations/dto.ts` | (3) module DTO | Conversation domain entity. |
| `CitedChunk` | `types.ts` | `modules/rag/dto.ts` | (3) module DTO | RAG chunk with citation metadata; referenced by `modules/ai/dto.ts` per mục 3.1 example. |
| `EmbeddingProviderName` | `types.ts` | `modules/rag/dto.ts` | (3) module DTO | RAG-specific embedding provider selector. |
| `VaultConfig` | `types.ts` | `config/index.ts` | (1) config | Env-driven vault/Pinecone settings assembled at composition root, referenced from `AppConfig.vaultConfig`. |
| `CitationResult` | `types.ts` | `modules/rag/dto.ts` | (3) module DTO | RAG citation-building output. |

## Notes

- No type is deleted or renamed in this pass — this table is the plan reviewed **before**
  Phase 1 moves any file, per mục 6 Phase 0 step 3.
- `AIAdapter` is a **port**, not a DTO, even though it currently lives in `types.ts` —
  it describes a capability the `ai` module needs from each provider adapter
  (`claudeAdapter`, `geminiAdapter`, ...), not data crossing a boundary.
- Actual extraction into `config/`, `core/shared/`, and each module's `dto.ts`/`ports.ts`
  happens in Phase 1 (`modules/canvas`, `modules/vault`) and later phases for
  `files`/`conversations`/`rag`/`ai`, per mục 6. `src/modules/*/domain (module-owned types)` will re-export from the
  new locations during the transition so existing imports keep compiling, then be
  removed once every import site is updated.
