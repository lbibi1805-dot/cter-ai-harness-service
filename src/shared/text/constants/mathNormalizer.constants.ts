/** `\begin{env}` environments whose content becomes plain display math: `$$<inner>$$`. */
export const PLAIN_DISPLAY_ENVS: ReadonlySet<string> = new Set(['equation', 'equation*', 'displaymath']);

/** Top-level environments that only work inside `$$` when rewritten to an inner environment. */
export const WRAPPED_DISPLAY_ENVS: Readonly<Record<string, string>> = {
  align: 'aligned',
  'align*': 'aligned',
  eqnarray: 'aligned',
  'eqnarray*': 'aligned',
  gather: 'gathered',
  'gather*': 'gathered',
};

/** `\begin{name}` at a position (sticky). Env names are letters with an optional trailing `*`. */
export const BEGIN_ENV_PATTERN = /\\begin\{([A-Za-z]+\*?)\}/y;

/** Loose mode: characters before `(` / `[` that mean it is part of LaTeX, not a math delimiter. */
export const LATEX_CONTEXT = /[\\{}\w$]/;
