export interface PolledItem {
  updatedAt: Date;
  /** True once the item reached a terminal outcome (done, failed, skipped). */
  settled: boolean;
}

/**
 * Advances the cursor through settled items in `updatedAt` order and stops at
 * the first unsettled one, so nothing unfinished can fall behind the cursor.
 * Timestamps come from Canvas, so local clock skew does not matter. The cursor
 * is inclusive: items exactly at the cursor are listed again and deduplicated.
 */
export function advanceWatermark(items: PolledItem[], current: Date | null): Date | null {
  const ordered = [...items].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  let next = current;
  for (const item of ordered) {
    if (!item.settled) break;
    if (!next || item.updatedAt > next) next = item.updatedAt;
  }
  return next;
}
