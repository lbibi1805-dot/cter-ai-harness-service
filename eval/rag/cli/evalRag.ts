// RAG retrieval evaluation against a (production) Pinecone index — read-only.
//
//   npm run eval:rag
//   npm run eval:rag -- --golden eval/rag/golden.jsonl --k 1,3,5,10,20 --label topk-baseline
//   npm run eval:rag -- --env path/to/other.env.eval
//   npm run eval:rag -- --rerank [--candidates 40] [--rerank-model bge-reranker-v2-m3]
//       also reranks the same candidates (Pinecone Inference, one call per question) and compares.
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_RERANK_CONFIG, PineconeReranker } from '../../../src/modules/rerank';
import { compareReports, createRerankVariants, formatComparison } from '../application/rerankComparison';
import { evaluateRetrieval, type QueryRetriever, type RetrievalReport } from '../application/retrievalEvaluation';
import { DEFAULT_K_VALUES, EvalCliFlag, type GoldenItem } from '../domain';
import { loadEvalSettings, maskSecret } from '../infrastructure/evalEnv';
import { loadGoldenSet } from '../infrastructure/goldenFile';
import { createPineconeQueryRetriever } from '../infrastructure/pineconeQueryRetriever';
import { DEFAULT_RUNS_DIR, formatReport, writeReport } from '../infrastructure/reportWriter';
import { hasFlag, readFlag } from '../../shared/cliArgs';

function parseK(value: string | undefined): number[] {
  if (!value) return [...DEFAULT_K_VALUES];
  const ks = value.split(',').map((v) => Number(v.trim()));
  if (ks.some((k) => !Number.isInteger(k) || k < 1)) throw new Error(`${EvalCliFlag.K} expects positive integers, e.g. 1,3,5,10`);
  return [...new Set(ks)].sort((a, b) => a - b);
}

function parseCandidates(value: string | undefined): number {
  const candidates = Number(value ?? DEFAULT_RERANK_CONFIG.candidates);
  if (!Number.isInteger(candidates) || candidates < 2) throw new Error(`${EvalCliFlag.CANDIDATES} expects an integer ≥ 2`);
  return candidates;
}

async function run(items: GoldenItem[], retriever: QueryRetriever, kValues: number[], label: string): Promise<RetrievalReport> {
  const report = await evaluateRetrieval(items, retriever, kValues, label, (done, total, item) => {
    process.stdout.write(`\r  ${label}: ${done}/${total} ${item.id.padEnd(28)}`);
  });
  process.stdout.write('\n');
  return report;
}

function printSummary(report: RetrievalReport, maxK: number): void {
  console.log(`\n${formatReport(report).split('\n## Per question')[0]}`);
  if (report.misses.length) console.log(`\nMisses (expected file not in top ${maxK}): ${report.misses.join(', ')}`);
  const errors = report.results.filter((r) => r.error);
  if (errors.length) console.log(`\nErrors: ${errors.map((r) => `${r.id}: ${r.error}`).join(' | ')}`);
}

async function main(): Promise<void> {
  const settings = loadEvalSettings(readFlag(EvalCliFlag.ENV));
  const kValues = parseK(readFlag(EvalCliFlag.K));
  const maxK = Math.max(...kValues);
  const label = readFlag(EvalCliFlag.LABEL) ?? `${settings.pineconeIndex}-${settings.embeddingProvider}`;
  const golden = loadGoldenSet(readFlag(EvalCliFlag.GOLDEN));
  const rerank = hasFlag(EvalCliFlag.RERANK);
  const candidates = rerank ? parseCandidates(readFlag(EvalCliFlag.CANDIDATES)) : maxK;
  const rerankModel = readFlag(EvalCliFlag.RERANK_MODEL) ?? DEFAULT_RERANK_CONFIG.model;

  console.log(`Pinecone index : ${settings.pineconeIndex} (key ${maskSecret(settings.pineconeApiKey)})`);
  console.log(`Embedding      : ${settings.embeddingProvider}`);
  console.log(`Golden set     : ${golden.file} (${golden.items.length} questions)`);
  console.log(`k values       : ${kValues.join(', ')}  — read-only, nothing is written to Pinecone`);
  if (rerank) console.log(`Rerank         : ${rerankModel} over ${candidates} candidates (${golden.items.length} rerank calls)`);
  console.log('');

  const pinecone = await createPineconeQueryRetriever(settings, Math.max(maxK, candidates));
  console.log(`Index OK       : dimension ${pinecone.index.dimension}, ${pinecone.index.recordCount ?? '?'} vectors\n`);

  if (!rerank) {
    const report = await run(golden.items, pinecone.retriever, kValues, label);
    printSummary(report, maxK);
    const files = writeReport(report);
    console.log(`\nReport: ${files.markdown}\nData:   ${files.json}`);
    if (report.erroredCount > 0) process.exitCode = 1;
    return;
  }

  const reranker = new PineconeReranker({ apiKey: settings.pineconeApiKey, model: rerankModel });
  const variants = createRerankVariants(pinecone.chunks, reranker, DEFAULT_RERANK_CONFIG);
  const vectorReport = await run(golden.items, variants.vector, kValues, `${label}-vector`);
  const rerankReport = await run(golden.items, variants.reranked, kValues, `${label}-rerank`);
  const fusedReport = await run(golden.items, variants.fused, kValues, `${label}-fused`);
  printSummary(vectorReport, maxK);
  printSummary(rerankReport, maxK);
  printSummary(fusedReport, maxK);

  const comparison = [
    formatComparison(compareReports(vectorReport, rerankReport), rerankModel, candidates, variants.timing),
    formatComparison(compareReports(vectorReport, fusedReport), rerankModel, candidates, variants.timing, 'Rerank + vector fusion (RRF) vs vector order'),
  ].join('\n\n');
  console.log(`\n${comparison}`);
  const vectorFiles = writeReport(vectorReport);
  const rerankFiles = writeReport(rerankReport);
  writeReport(fusedReport);
  const comparisonFile = path.join(DEFAULT_RUNS_DIR, `${rerankReport.startedAt.replace(/[:.]/g, '-')}-${label.replace(/[^\w.-]+/g, '_')}-comparison.md`);
  fs.writeFileSync(comparisonFile, comparison);
  console.log(`\nReports: ${vectorFiles.markdown}\n         ${rerankFiles.markdown}\nComparison: ${comparisonFile}`);
  if (vectorReport.erroredCount + rerankReport.erroredCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`eval:rag failed — ${(err as Error).message}`);
  process.exitCode = 1;
});
