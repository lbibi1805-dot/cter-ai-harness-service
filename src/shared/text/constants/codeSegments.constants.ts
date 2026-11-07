/** Opening code fence at a line start (sticky): ≤3 spaces of indent, then 3+ backticks or tildes, then the info string. */
export const FENCE_OPEN_PATTERN = /( {0,3})(`{3,}|~{3,})([^\n]*)/y;

/** Info string of a Mermaid fence. */
export const MERMAID_INFO = 'mermaid';
