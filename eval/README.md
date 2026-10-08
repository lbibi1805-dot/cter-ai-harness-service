# Evaluation

Offline evaluation scripts. Not part of the service build (`tsconfig` only compiles `src/`).

## RAG retrieval (`eval/rag`)

Measures how well Pinecone retrieval finds the right vault files for a question:
Hit@k, Recall@k, Precision@k, MRR, and top-1 similarity scores (relevant vs.
irrelevant vs. unanswerable — useful for choosing a score floor).

**Read-only:** it embeds the golden questions and queries the index. It never
creates, writes or deletes anything, and aborts if the embedding provider does
not match the index dimension.

### Setup

1. `cp eval/.env.eval.example eval/.env.eval` and fill in the production
   Pinecone credentials (variable names: `EvalEnvKey` in
   `rag/domain/eval.enums.ts`). The file is gitignored.
2. `cp eval/rag/golden.example.jsonl eval/rag/golden.jsonl` and grow it to
   30–50 questions. Label `expected_sources` with vault-relative file paths.
   Add a few `"answerable": false` questions.

### Run

```bash
npm run eval:rag
npm run eval:rag -- --k 1,3,5,8,10,20 --label topk-baseline
npm run eval:rag -- --golden path/to/set.jsonl --env path/to/other.env.eval
```

Reports are written to `eval/rag/runs/<timestamp>-<label>.{md,json}` (gitignored).

### Reading the results

- **Hit@k ≈ Hit@20 at a small k** → `RAG_TOP_K` can be lowered (cheaper, less noise).
- **Low Precision@k** → most of the context sent to the LLM is irrelevant.
- **Misses** → missing/poorly chunked documents, or a golden label to fix.
- **Unanswerable top-1 scores well below relevant ones** → a minimum-score filter would work.

### Layout

| Layer | Files |
|---|---|
| domain | `eval.enums.ts`, `golden.ts`, `retrievalMetrics.ts` (pure) |
| application | `retrievalEvaluation.ts` (runs a golden set through a `QueryRetriever` port) |
| infrastructure | `evalEnv.ts`, `pineconeQueryRetriever.ts`, `goldenFile.ts`, `reportWriter.ts` |
| cli | `evalRag.ts` |
