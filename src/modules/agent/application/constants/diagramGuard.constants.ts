/** Below this much time left before the request deadline, the guard keeps the answer as is (12/11 plan 03 §5). */
export const MIN_GUARD_TIME_MS = 3_000;

export const DEFAULT_DIAGRAM_GUARD_ENABLED = true;

export const DEFAULT_DIAGRAM_MAX_REPAIRS = 1;

export const DEFAULT_AGENT_MAX_DIAGRAM_VALIDATIONS = 3;

/** Shown under a diagram whose connectivity errors the repair could not fix (12/11 plan 04 §4.3, Vietnamese UI). */
export const CONNECTIVITY_WARNING = (problems: string[]) => `> ⚠️ Sơ đồ còn khối chưa được nối đủ: ${problems.join(' ')}`;
