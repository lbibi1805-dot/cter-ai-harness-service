/**
 * `modules/canvas` public API — per mục 3.1, only `dto`/`ports`/public
 * functions are exported here. `CanvasClient` remains in `src/canvas/canvasClient.ts`
 * for now (its full move into `modules/canvas/internal` happens in a later phase
 * alongside the `files`/`conversations` module split).
 */
export * from './dto';
export * from './ports';
