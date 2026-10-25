export interface PolledItem {
  updatedAt: Date;
  /** True once the item reached a terminal outcome (done, failed, skipped). */
  settled: boolean;
}
