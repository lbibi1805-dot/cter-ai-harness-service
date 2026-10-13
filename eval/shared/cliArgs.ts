import type { EvalCliFlag } from '../rag/domain';

/** Reads `--flag value` or `--flag=value`. */
export function readFlag(flag: EvalCliFlag, argv: string[] = process.argv.slice(2)): string | undefined {
  const index = argv.indexOf(flag);
  if (index !== -1) return argv[index + 1];
  return argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

export function hasFlag(flag: EvalCliFlag, argv: string[] = process.argv.slice(2)): boolean {
  return argv.includes(flag);
}
