export type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };
