/** Candidates fetched per `search_vault` call before the optional folder filter trims them. */
export const AGENT_SEARCH_CANDIDATES = 10;
/** Passages shown to the model per `search_vault` result. */
export const SEARCH_RESULTS_SHOWN = 5;
/** Entries shown per `list_folder` result. */
export const MAX_LISTED_ITEMS = 60;
/** Headings suggested when `read_document` cannot find the requested one. */
export const MAX_HEADINGS_SUGGESTED = 30;
/** Transport retries per model turn (the agent has no model fallback chain of its own). */
export const AGENT_TRANSPORT_ATTEMPTS = 3;

export const TRUNCATION_NOTE = '\n…[truncated — ask for a specific heading to read the rest]';
/** Sent as the last tool output when the budget runs out, before the forced final turn. */
export const BUDGET_EXHAUSTED_NOTE = 'Research budget exhausted. Write the final answer now using only what you have already found.';

/** File name marker: `START_<name>_<provider>[_<model>]_agent.<ext>`. */
export const AGENT_FILE_SUFFIX = '_agent';
