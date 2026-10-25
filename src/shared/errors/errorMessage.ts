/** Human-readable message for anything thrown (`throw` in JS accepts non-Error values). */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
