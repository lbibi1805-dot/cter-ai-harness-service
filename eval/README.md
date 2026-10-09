# Evaluation

Offline evaluation scripts. Not part of the service build (`tsconfig` only compiles `src/`).

| Script | Measures | Cost |
|---|---|---|
| `npm run eval:rag` | Retrieval: Hit@k, Recall@k, Precision@k, MRR, similarity scores | embeddings only |
| `npm run eval:answers` | Answers end-to-end, single-shot vs agent: latency, answer precision, completeness, citations, refusals, consistency, drift | answer + judge model calls |

Both read `eval/.env.eval` (gitignored) and touch production **read-only**.

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

## Answers (`eval/answers`)

Runs every golden question through the **production answer path** (same
`PromptPreparer` + RAG, `AIInvocationService`, agent module) in each mode,
then grades it with a judge model against the **expected source documents**
read from the vault.

| Metric | Definition |
|---|---|
| answerPrecision | supported claims / all claims in the answer (judged against the reference docs) |
| completeness | golden `key_points` covered / all key points |
| f1 | harmonic mean of the two above |
| relevance | judge 1–5, normalised |
| citationPrecision / Recall | files in the answer's `References` vs `expected_sources` |
| refusalAccuracy | refuses exactly for `"answerable": false` questions |
| errorRate / fallbackRate | failed answers / agent requests answered single-shot |
| latency p50 / p95 / max | wall clock per answer |
| consistency | mean embedding similarity of repeated answers (`--repeats > 1`) |
| agent tokens / tool calls | from the agent run (single-shot adapters do not report usage yet) |

**Drift** (`--baseline latest|<run.json>`): metric changes per mode
(beyond noise thresholds in `answerEval.enums.ts`), data drift (vault file
count, indexed count, Pinecone vector count), and per question: F1 drop,
how much the answer's meaning changed (embedding similarity) and which
sources were used (Jaccard).

```bash
npm run eval:answers                                   # plan only — shows how many API calls it would make
npm run eval:answers -- --yes --label baseline         # first run
npm run eval:answers -- --yes --baseline latest --label after-change
npm run eval:answers -- --yes --modes agent --repeats 3 --limit 10
```

Extra `.env.eval` keys: `DATABASE_URL` (SELECT only), `ANSWER_MODEL`
(Responses-API model, default `gpt-6-astra`), `JUDGE_MODEL` (default
`gpt-4o`), `RAG_TOP_K`, `SYSTEM_PROMPT_FILE`. Runs are saved to
`eval/answers/runs/` (gitignored).

Caveats: the judge is an LLM — spot-check a few graded answers per run, and
keep the golden set's `key_points` and `expected_sources` accurate; that is
what the scores are measured against.
