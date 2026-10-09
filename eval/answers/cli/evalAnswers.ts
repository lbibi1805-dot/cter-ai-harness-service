// End-to-end answer evaluation: latency, answer precision/completeness, citations,
// refusals, consistency and drift vs a baseline — single-shot vs agent.
// Spends real API credits, so without --yes it only prints the plan.
//
//   npm run eval:answers                                     # plan only
//   npm run eval:answers -- --yes --label baseline
//   npm run eval:answers -- --yes --baseline latest --label after-chunking-change
//   npm run eval:answers -- --yes --modes agent --repeats 3 --limit 10
import { getNeonSql } from '../../../src/shared/database/database';
import { AnswerMode } from '../../../src/modules/agent/domain';
import { EvalCliFlag } from '../../rag/domain';
import { maskSecret } from '../../rag/infrastructure/evalEnv';
import { loadGoldenSet } from '../../rag/infrastructure/goldenFile';
import { hasFlag, readFlag } from '../../shared/cliArgs';
import { runAnswerEval } from '../application/answerEvaluation';
import { analyzeDrift } from '../application/driftAnalysis';
import type { AnswerEvalReport } from '../domain';
import { loadAnswerEvalSettings } from '../infrastructure/answerEvalEnv';
import { LATEST_BASELINE, loadBaseline, saveAnswerReport } from '../infrastructure/answerRunStore';
import { formatAnswerReport } from '../infrastructure/answerReportFormatter';
import { OpenAIJudge } from '../infrastructure/openaiJudge';
import { buildEvalAppConfig, captureEnvironment, createProductionAnswerer, createTextEmbedder } from '../infrastructure/productionAnswerer';
import { ReadOnlyNeonVaultRepository, VaultReferenceLoader } from '../infrastructure/readOnlyVault';

const DEFAULT_MODES = [AnswerMode.SINGLE_SHOT, AnswerMode.AGENT];
/** Rough upper bound of model calls per agent answer (tool turns + final). */
const AGENT_CALLS_UPPER_BOUND = 7;

function parseModes(value: string | undefined): AnswerMode[] {
  if (!value) return DEFAULT_MODES;
  const modes = value.split(',').map((m) => m.trim());
  const valid = Object.values(AnswerMode) as string[];
  const invalid = modes.filter((m) => !valid.includes(m));
  if (invalid.length) throw new Error(`${EvalCliFlag.MODES}: unknown mode(s) ${invalid.join(', ')} — use ${valid.join(', ')}`);
  return modes as AnswerMode[];
}

function positiveInt(flag: EvalCliFlag, fallback: number): number {
  const raw = readFlag(flag);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${flag} expects a positive integer`);
  return value;
}

async function main(): Promise<void> {
  const settings = loadAnswerEvalSettings(readFlag(EvalCliFlag.ENV));
  const modes = parseModes(readFlag(EvalCliFlag.MODES));
  const repeats = positiveInt(EvalCliFlag.REPEATS, 1);
  const golden = loadGoldenSet(readFlag(EvalCliFlag.GOLDEN));
  const items = golden.items.slice(0, positiveInt(EvalCliFlag.LIMIT, golden.items.length));
  const label = readFlag(EvalCliFlag.LABEL) ?? `${settings.answerModel}-${modes.join('+')}`;
  const baselineRef = readFlag(EvalCliFlag.BASELINE);

  const answers = items.length * modes.length * repeats;
  const maxModelCalls = items.length * repeats * (modes.includes(AnswerMode.SINGLE_SHOT) ? 1 : 0)
    + items.length * repeats * (modes.includes(AnswerMode.AGENT) ? AGENT_CALLS_UPPER_BOUND : 0);
  console.log(`Golden set     : ${golden.file} (${items.length} questions)`);
  console.log(`Modes × repeats: ${modes.join(', ')} × ${repeats}  →  ${answers} answers`);
  console.log(`Answer model   : openai/${settings.answerModel} · judge: ${settings.judgeModel} · RAG_TOP_K ${settings.ragTopK}`);
  console.log(`Production     : Pinecone ${settings.pineconeIndex} (key ${maskSecret(settings.pineconeApiKey)}), Neon (SELECT only)`);
  console.log(`API calls      : ≤ ${maxModelCalls} answer-model calls + ${answers} judge calls + embeddings`);
  console.log(`Baseline       : ${baselineRef ?? 'none (pass --baseline latest|<run.json> to measure drift)'}\n`);
  if (!hasFlag(EvalCliFlag.YES)) {
    console.log(`Plan only — nothing was called. Re-run with ${EvalCliFlag.YES} to execute.`);
    return;
  }

  // Resolve the baseline BEFORE this run is saved (otherwise "latest" would be this run).
  const baseline = baselineRef ? loadBaseline(baselineRef) : null;
  if (baselineRef && !baseline) console.log(`No baseline found for "${baselineRef}" — drift will be skipped.\n`);

  const vaultRepository = new ReadOnlyNeonVaultRepository(getNeonSql(settings.databaseUrl));
  const config = buildEvalAppConfig(settings);
  const embedder = createTextEmbedder(settings);
  const environment = await captureEnvironment(settings, vaultRepository);
  const startedAt = new Date();

  const result = await runAnswerEval(items, {
    answerer: createProductionAnswerer(config, vaultRepository),
    judge: new OpenAIJudge(settings.openaiApiKey, settings.judgeModel),
    references: new VaultReferenceLoader(vaultRepository),
    embedder,
    provider: 'openai',
    answerModel: settings.answerModel,
  }, {
    modes,
    repeats,
    onProgress: (done, total, current) => process.stdout.write(`\r  ${done}/${total} ${current.padEnd(40)}`),
  });
  process.stdout.write('\n\n');

  const report: AnswerEvalReport = {
    label,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    settings: { answerModel: settings.answerModel, judgeModel: settings.judgeModel, modes, repeats, questionCount: items.length },
    environment,
    summaries: result.summaries,
    samples: result.samples,
  };
  if (baseline) report.drift = await analyzeDrift(baseline, report, embedder);

  const markdown = formatAnswerReport(report);
  console.log(markdown.split('\n## Per question')[0]);
  const files = saveAnswerReport(report);
  console.log(`\nReport: ${files.markdown}\nData:   ${files.json}`);
  if (baselineRef === LATEST_BASELINE && !baseline) console.log('(Saved as the first run — the next run with --baseline latest compares against it.)');
}

main().catch((err) => {
  console.error(`eval:answers failed — ${(err as Error).message}`);
  process.exitCode = 1;
});
