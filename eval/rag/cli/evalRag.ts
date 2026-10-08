// RAG retrieval evaluation against a (production) Pinecone index — read-only.
//
//   npm run eval:rag
//   npm run eval:rag -- --golden eval/rag/golden.jsonl --k 1,3,5,10,20 --label topk-baseline
//   npm run eval:rag -- --env path/to/other.env.eval
import { evaluateRetrieval } from '../application/retrievalEvaluation';
import { DEFAULT_K_VALUES, EvalCliFlag } from '../domain';
import { loadEvalSettings, maskSecret } from '../infrastructure/evalEnv';
import { loadGoldenSet } from '../infrastructure/goldenFile';
import { createPineconeQueryRetriever } from '../infrastructure/pineconeQueryRetriever';
import { formatReport, writeReport } from '../infrastructure/reportWriter';

function readFlag(flag: EvalCliFlag): string | undefined {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index !== -1) return args[index + 1];
  return args.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

function parseK(value: string | undefined): number[] {
  if (!value) return [...DEFAULT_K_VALUES];
  const ks = value.split(',').map((v) => Number(v.trim()));
  if (ks.some((k) => !Number.isInteger(k) || k < 1)) throw new Error(`${EvalCliFlag.K} expects positive integers, e.g. 1,3,5,10`);
  return [...new Set(ks)].sort((a, b) => a - b);
}

async function main(): Promise<void> {
  const settings = loadEvalSettings(readFlag(EvalCliFlag.ENV));
  const kValues = parseK(readFlag(EvalCliFlag.K));
  const label = readFlag(EvalCliFlag.LABEL) ?? `${settings.pineconeIndex}-${settings.embeddingProvider}`;
  const golden = loadGoldenSet(readFlag(EvalCliFlag.GOLDEN));

  console.log(`Pinecone index : ${settings.pineconeIndex} (key ${maskSecret(settings.pineconeApiKey)})`);
  console.log(`Embedding      : ${settings.embeddingProvider}`);
  console.log(`Golden set     : ${golden.file} (${golden.items.length} questions)`);
  console.log(`k values       : ${kValues.join(', ')}  — read-only, nothing is written to Pinecone\n`);

  const { retriever, index } = await createPineconeQueryRetriever(settings, Math.max(...kValues));
  console.log(`Index OK       : dimension ${index.dimension}, ${index.recordCount ?? '?'} vectors\n`);

  const report = await evaluateRetrieval(golden.items, retriever, kValues, label, (done, total, item) => {
    process.stdout.write(`\r  ${done}/${total} ${item.id.padEnd(12)}`);
  });
  process.stdout.write('\n\n');

  console.log(formatReport(report).split('\n## Per question')[0]);
  if (report.misses.length) console.log(`\nMisses (expected file not in top ${Math.max(...kValues)}): ${report.misses.join(', ')}`);
  const files = writeReport(report);
  console.log(`\nReport: ${files.markdown}\nData:   ${files.json}`);
  if (report.erroredCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`eval:rag failed — ${(err as Error).message}`);
  process.exitCode = 1;
});
