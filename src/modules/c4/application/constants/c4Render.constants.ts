/** Longest PlantUML source `POST /api/c4/render` accepts (a big C4 component diagram is ~10 KB). */
export const MAX_RENDER_SOURCE_CHARS = 100_000;

/** Rendered previews kept in RAM (re-opening a chat message costs no PlantUML call). */
export const RENDER_CACHE_MAX_ENTRIES = 100;

/** Byte budget of the cached PNGs, so a few huge diagrams cannot grow the process past Render's RAM. */
export const RENDER_CACHE_MAX_BYTES = 32 * 1024 * 1024;
