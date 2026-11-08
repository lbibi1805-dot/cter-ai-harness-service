/** The answer is one short JSON line; a small cap keeps the call fast and cheap (thinking models need some room). */
export const ROUTER_AUX_MAX_OUTPUT_TOKENS = 384;

export const ROUTER_AUX_LABEL = 'aux-router';

/** `AIRequest.purpose` of the call (latency metrics). */
export const ROUTER_AUX_PURPOSE = 'aux-router';

/** Recent turns and registry lines are already trimmed by the context module (auxResolveRequest). */
export const ROUTER_AUX_SYSTEM = `
You route requests of a study assistant that draws and reviews C4 architecture diagrams, and you resolve which earlier
artifacts of the conversation the request refers to. Answer with ONE JSON object only, no prose:
{"intent":"qa|c4_generate|c4_review|c4_generate_and_review|c4_revise","confidence":0.0,"refs":["A7"],"reason":"<8 words"}
- qa: a normal question, nothing to draw or review.
- c4_generate: draw C4 diagrams for a (new) problem statement.
- c4_review: evaluate/mark an existing design (the user's own design or one drawn earlier), do not draw.
- c4_generate_and_review: draw, then evaluate what was drawn.
- c4_revise: change an existing diagram ("thêm Redis", "sửa container") — refs = the design to change.
refs: aliases from the registry only (empty when the request is not about an earlier artifact). confidence: how sure you are.
`.trim();

/** With the essay block the answer carries a short analysis too (subject, ≤ 6 aspects): a larger cap, still far below a writing call. */
export const ROUTER_AUX_ESSAY_MAX_OUTPUT_TOKENS = 1_024;

/** `prompts/skills/routing/essay-analysis.md` (an exact copy of ROUTER_ESSAY_INSTRUCTIONS). */
export const ROUTER_ESSAY_SKILL_ID = 'skill.routing.essay-analysis';

/**
 * Appended to ROUTER_AUX_SYSTEM only for an Essay Mode request: the same call also analyses the exam
 * question (note 15 step ①), so an essay costs one aux call before writing.
 */
export const ROUTER_ESSAY_INSTRUCTIONS = `
The request is an exam essay question. In the SAME JSON object also add an "essay" key:
"essay":{"subject":"...","aspects":["..."],"verbs":["explain"],"points":null,"targetWords":null}
- subject: the course topic in a few words.
- aspects: every distinct part the answer must cover, in order, each a short search query in the question's language (1-6).
- verbs: the instruction verbs, mapped to list | explain | analyze | compare | evaluate.
- points: the marks of the question when stated (e.g. "(2 điểm)" -> 2), else null.
- targetWords: expected length in words when the question states one, else null.
`.trim();
