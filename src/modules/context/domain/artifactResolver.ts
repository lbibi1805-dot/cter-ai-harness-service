import {
  ArtifactKind,
  MessageRole,
  ResolvedRefSource,
  type ResolvedRefs,
  type StoredArtifact,
} from '../../conversation-store';
import {
  artifactAlias,
  displayLabel,
  elementNames,
  levelsOf,
  ownerOf,
  systemNameOf,
  turnOf,
} from './artifactMetadata';
import {
  ANAPHORA_WORDS,
  AUX_RECENT_TURNS,
  AUX_REGISTRY_MAX_LINES,
  AUX_TURN_MAX_CHARS,
  COMPARE_WORDS,
  CONFIDENCE,
  DEFAULT_RESOLVER_SETTINGS,
  DESIGN_WORDS,
  DIAGRAM_WORDS,
  DRAW_VERBS,
  ENTITY_FULL_MATCH_HITS,
  ENTITY_MIN_TOKEN_CHARS,
  ENTITY_STOPWORDS,
  FIRST_WORDS,
  IMAGE_WORDS,
  LATEST_WORDS,
  LEVEL_WORDS,
  MASKED_COMPOUNDS,
  MAX_AMBIGUOUS_CANDIDATES,
  ORDINAL_PATTERN,
  OWNER_ASSISTANT_WORDS,
  OWNER_USER_WORDS,
  PREVIOUS_WORDS,
  PROBLEM_WORDS,
  REFERABLE_KINDS,
  RESOLVER_WEIGHTS,
  REVIEW_WORDS,
  TURN_PATTERN,
} from './constants/artifactResolver.constants';
import { ARTIFACT_ALIAS_PATTERN } from './constants/context.constants';
import { ArtifactResolverMode, TemporalCue } from './enums/context.enums';
import { containsWord, hasDiacritics, maskCompounds, stripDiacritics, tokenize } from './helpers/textMatch.helper';
import type {
  AuxResolveRequest,
  AuxResolver,
  ReferenceSignals,
  ResolveInput,
  ResolveResult,
  ResolverSettings,
  ScoreBreakdown,
  ScoredCandidate,
} from './interfaces/artifactResolver.interface';

const CUE_WORDS = [
  ...DIAGRAM_WORDS, ...IMAGE_WORDS, ...DRAW_VERBS, ...DESIGN_WORDS, ...PROBLEM_WORDS, ...REVIEW_WORDS, ...Object.keys(LEVEL_WORDS),
  ...OWNER_ASSISTANT_WORDS, ...OWNER_USER_WORDS, ...LATEST_WORDS, ...PREVIOUS_WORDS, ...FIRST_WORDS, ...COMPARE_WORDS, ...ANAPHORA_WORDS,
].flatMap(tokenize);
/** Words that never identify a system: exact forms ("vẽ" ≠ "vé"), and accent-free forms for accent-free questions. */
const IGNORED_EXACT = new Set([...ENTITY_STOPWORDS.flatMap(tokenize), ...CUE_WORDS]);
const IGNORED_PLAIN = new Set([...IGNORED_EXACT].map(stripDiacritics));

// ── ① signals ──────────────────────────────────────────────────────────────

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** Reference signals of a question (§3.1): whole-word, NFC, compounds such as "vấn đề" masked. */
export function extractSignals(question: string): ReferenceSignals {
  // Typed without accents ("dat ve thiet ke"): cues are matched accent-insensitively too.
  const plain = !hasDiacritics(question);
  const fold = (words: readonly string[]) => (plain ? words.map(stripDiacritics) : words);
  const text = maskCompounds(plain ? stripDiacritics(question) : question, fold(MASKED_COMPOUNDS));
  const has = (words: readonly string[]) => containsWord(text, fold(words));

  const aliases = uniq([...question.matchAll(ARTIFACT_ALIAS_PATTERN)].map((m) => `A${Number(m[1])}`));
  const owner = has(OWNER_USER_WORDS) ? MessageRole.USER : has(OWNER_ASSISTANT_WORDS) ? MessageRole.ASSISTANT : null;
  const levels = uniq(Object.entries(LEVEL_WORDS).filter(([word]) => has([word])).map(([, level]) => level));

  const diagram = has(DIAGRAM_WORDS);
  const image = has(IMAGE_WORDS);
  const draws = has(DRAW_VERBS);
  // A picture the assistant drew: "sơ đồ", "bản vẽ", or "hình/ảnh" + "vẽ", or "hình của bạn".
  const drawn = owner !== MessageRole.USER && (diagram || (image && (draws || owner === MessageRole.ASSISTANT)));

  const kinds: ArtifactKind[] = [];
  if (drawn) kinds.push(ArtifactKind.C4_SPEC);
  if ((diagram || image) && owner === MessageRole.USER) kinds.push(ArtifactKind.USER_IMAGE);
  if (image && !drawn && owner !== MessageRole.USER) kinds.push(ArtifactKind.USER_IMAGE);
  if (has(DESIGN_WORDS)) {
    kinds.push(ArtifactKind.C4_SPEC, ArtifactKind.DESIGN_NOTE);
    if (owner === MessageRole.USER) kinds.push(ArtifactKind.USER_IMAGE);
  }
  if (has(PROBLEM_WORDS)) kinds.push(ArtifactKind.PROBLEM_BRIEF, ArtifactKind.USER_IMAGE);
  if (has(REVIEW_WORDS)) kinds.push(ArtifactKind.DESIGN_REVIEW);
  if (kinds.length === 0 && levels.length > 0) kinds.push(ArtifactKind.C4_SPEC);

  const temporal = has(COMPARE_WORDS) ? TemporalCue.COMPARE
    : has(LATEST_WORDS) ? TemporalCue.LATEST
      : has(PREVIOUS_WORDS) ? TemporalCue.PREVIOUS
        : has(FIRST_WORDS) ? TemporalCue.FIRST
          : null;
  const ordinal = text.match(ORDINAL_PATTERN);
  const turn = text.match(TURN_PATTERN);

  const entityTokens = uniq(
    tokenize(text).filter((t) => t.length >= ENTITY_MIN_TOKEN_CHARS && !/^a\d+$/.test(t) && !/^\d+$/.test(t)
      && !(plain ? IGNORED_PLAIN.has(stripDiacritics(t)) : IGNORED_EXACT.has(t))),
  );

  return {
    aliases,
    kinds: uniq(kinds),
    drawn,
    levels,
    owner,
    temporal,
    ordinal: ordinal ? Number(ordinal[1]) : null,
    turn: turn ? Number(turn[1]) : null,
    reference: has(ANAPHORA_WORDS),
    entityTokens,
  };
}

/** Anything beyond fuzzy entity words: kind, level, owner, time, alias, anaphora. */
export function hasStrongSignal(s: ReferenceSignals): boolean {
  return s.aliases.length > 0 || s.kinds.length > 0 || s.levels.length > 0 || s.owner !== null || s.temporal !== null
    || s.ordinal !== null || s.turn !== null || s.reference || s.drawn;
}

// ── ② scoring ──────────────────────────────────────────────────────────────

function entityBag(artifact: StoredArtifact): { exact: Set<string>; stripped: Set<string> } {
  const text = [artifact.label, artifact.kind === ArtifactKind.USER_IMAGE ? artifact.caption : '', systemNameOf(artifact), ...elementNames(artifact)]
    .filter(Boolean).join(' ');
  const tokens = tokenize(text);
  return { exact: new Set(tokens), stripped: new Set(tokens.map(stripDiacritics)) };
}

/** 0..1: share of the question's entity words found in the artifact (typed without accents → accent-insensitive). */
export function entityMatch(tokens: string[], artifact: StoredArtifact): number {
  if (tokens.length === 0) return 0;
  const bag = entityBag(artifact);
  const hits = tokens.filter((t) => bag.exact.has(t) || (!hasDiacritics(t) && bag.stripped.has(t))).length;
  return Math.min(1, hits / Math.min(ENTITY_FULL_MATCH_HITS, tokens.length));
}

/** Ids the time/order words point at, among candidates (ordered by ordinal). */
function temporalTargets(signals: ReferenceSignals, candidates: StoredArtifact[]): Set<string> {
  const targets = new Set<string>();
  if (candidates.length === 0) return targets;
  const newest = candidates[candidates.length - 1];
  const parentOf = (a: StoredArtifact) => candidates.find((c) => c.id === a.parentArtifactId);
  if (signals.turn !== null) for (const a of candidates) if (turnOf(a.messageSeq) === signals.turn) targets.add(a.id);
  if (signals.ordinal !== null) {
    // With version chains "bản 2" is a version number, otherwise the n-th candidate in time.
    const chained = candidates.some((a) => (a.version ?? 1) > 1);
    if (chained) for (const a of candidates) { if ((a.version ?? 1) === signals.ordinal) targets.add(a.id); }
    else if (candidates[signals.ordinal - 1]) targets.add(candidates[signals.ordinal - 1].id);
  }
  switch (signals.temporal) {
    case TemporalCue.LATEST: targets.add(newest.id); break;
    case TemporalCue.FIRST: targets.add(candidates[0].id); break;
    case TemporalCue.PREVIOUS: targets.add((parentOf(newest) ?? newest).id); break;
    case TemporalCue.COMPARE: {
      const parent = parentOf(newest);
      targets.add(newest.id);
      if (parent) targets.add(parent.id);
      break;
    }
    default: break;
  }
  return targets;
}

export function scoreCandidates(signals: ReferenceSignals, candidates: StoredArtifact[]): ScoredCandidate[] {
  const ordered = [...candidates].sort((a, b) => a.ordinal - b.ordinal);
  const targets = temporalTargets(signals, ordered);
  const kinds = new Set(signals.kinds);
  return ordered.map((artifact, i) => {
    const owner = ownerOf(artifact);
    const levels = levelsOf(artifact);
    const breakdown: ScoreBreakdown = {
      kind: kinds.has(artifact.kind) ? RESOLVER_WEIGHTS.kind : 0,
      level: signals.levels.some((l) => levels.includes(l)) ? RESOLVER_WEIGHTS.level : 0,
      entity: RESOLVER_WEIGHTS.entity * entityMatch(signals.entityTokens, artifact),
      owner: signals.owner === null ? 0 : signals.owner === owner ? RESOLVER_WEIGHTS.ownerMatch : RESOLVER_WEIGHTS.ownerMismatch,
      temporal: targets.has(artifact.id) ? RESOLVER_WEIGHTS.temporal : 0,
      recency: RESOLVER_WEIGHTS.recency * ((i + 1) / ordered.length),
    };
    const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
    return { artifact, alias: artifactAlias(artifact), score: Math.round(score * 100) / 100, breakdown };
  }).sort((a, b) => b.score - a.score || b.artifact.ordinal - a.artifact.ordinal);
}

// ── decision ───────────────────────────────────────────────────────────────

function settingsOf(input: ResolveInput): ResolverSettings {
  return { ...DEFAULT_RESOLVER_SETTINGS, ...input.settings };
}

function result(source: ResolvedRefSource, picked: StoredArtifact[], confidence: number, candidates: ScoredCandidate[], signals: ReferenceSignals, ambiguous = false): ResolveResult {
  return { picked, source, confidence, candidates, ambiguous, signals };
}

function byRef(artifacts: StoredArtifact[], refs: string[]): StoredArtifact[] {
  const wanted = new Set(refs.map((r) => r.trim().replace(/^\[|\]$/g, '').toUpperCase()));
  return artifacts.filter((a) => wanted.has(artifactAlias(a)) || wanted.has(a.id.toUpperCase())).sort((a, b) => a.ordinal - b.ordinal);
}

/**
 * Artifact resolver, rules only (note 17 §3, steps G → B): pure, < 1 ms.
 * Order: UI refs → typed alias → no signal (= no resolve) → single candidate of the
 * asked kind → scored candidates (sure when top1 ≥ minScore and top1 − top2 ≥ margin)
 * → otherwise ambiguous: the two best are the choices, the newest of them the default.
 */
export function resolveArtifacts(input: ResolveInput): ResolveResult {
  const settings = settingsOf(input);
  const signals = extractSignals(input.question);
  const none = (candidates: ScoredCandidate[] = []) => result(ResolvedRefSource.NONE, [], CONFIDENCE.none, candidates, signals);

  if (input.refIds?.length) {
    const explicit = byRef(input.artifacts, input.refIds);
    if (explicit.length > 0) return result(ResolvedRefSource.UI, explicit, CONFIDENCE.explicit, [], signals);
  }
  if (settings.mode === ArtifactResolverMode.OFF) return none();
  if (signals.aliases.length > 0) {
    const typed = byRef(input.artifacts, signals.aliases);
    if (typed.length > 0) return result(ResolvedRefSource.RULE, typed, CONFIDENCE.explicit, [], signals);
  }
  const strong = hasStrongSignal(signals);
  if (!strong && signals.entityTokens.length === 0) return none();

  const referable = input.artifacts.filter((a) => REFERABLE_KINDS.includes(a.kind));
  const candidates = signals.kinds.length > 0 ? referable.filter((a) => signals.kinds.includes(a.kind)) : referable;
  if (candidates.length === 0) return none();

  const scored = scoreCandidates(signals, candidates);
  const [top1, top2] = scored;
  const sure = top1.score >= settings.minScore && top1.score - (top2?.score ?? Number.NEGATIVE_INFINITY) >= settings.margin;

  if (!strong) {
    // Entity words alone ("vì sao dùng RabbitMQ") resolve only on a full match that clearly leads.
    const clear = top1.breakdown.entity >= RESOLVER_WEIGHTS.entity && top1.score - (top2?.score ?? Number.NEGATIVE_INFINITY) >= settings.margin;
    return clear ? result(ResolvedRefSource.RULE, [top1.artifact], CONFIDENCE.sure, scored, signals) : none(scored);
  }
  if (signals.temporal === TemporalCue.COMPARE) {
    const pair = scored.filter((c) => c.breakdown.temporal > 0).map((c) => c.artifact);
    if (pair.length === 2) return result(ResolvedRefSource.RULE, pair.sort((a, b) => a.ordinal - b.ordinal), CONFIDENCE.sure, scored, signals);
  }
  if (signals.kinds.length > 0 && candidates.length === 1 && top1.breakdown.owner >= 0) {
    return result(ResolvedRefSource.RULE, [top1.artifact], CONFIDENCE.singleCandidate, scored, signals);
  }
  if (sure) return result(ResolvedRefSource.RULE, [top1.artifact], CONFIDENCE.sure, scored, signals);
  if (top1.score <= 0) return none(scored);
  if (!top2 || top2.score <= 0) return result(ResolvedRefSource.RULE, [top1.artifact], CONFIDENCE.onlyViable, scored, signals);

  const choices = scored.slice(0, MAX_AMBIGUOUS_CANDIDATES);
  const fallback = choices.reduce((newest, c) => (c.artifact.ordinal > newest.artifact.ordinal ? c : newest));
  return result(ResolvedRefSource.AMBIGUOUS, [fallback.artifact], CONFIDENCE.ambiguous, choices, signals, true);
}

/** Registry + recent turns for the aux resolver (§3.3). */
export function auxResolveRequest(input: ResolveInput, timeoutMs: number): AuxResolveRequest {
  return {
    question: input.question,
    registry: input.artifacts.filter((a) => REFERABLE_KINDS.includes(a.kind)).slice(-AUX_REGISTRY_MAX_LINES).map((a) => ({
      alias: artifactAlias(a), kind: a.kind, owner: ownerOf(a), turn: turnOf(a.messageSeq), label: displayLabel(a),
    })),
    recentTurns: (input.messages ?? []).slice(-AUX_RECENT_TURNS * 2).map((m) => `${m.role}: ${m.text.slice(0, AUX_TURN_MAX_CHARS)}`),
    timeoutMs,
  };
}

/**
 * Rules, then (mode rules+aux, only when ambiguous) the aux resolver. Ids the aux model
 * invents are dropped; a low confidence, an error or a timeout keeps the ambiguous
 * result — the answer never fails because of the resolver.
 */
export async function resolveArtifactsWithAux(input: ResolveInput, aux: AuxResolver | null): Promise<ResolveResult> {
  const rules = resolveArtifacts(input);
  const settings = settingsOf(input);
  if (!rules.ambiguous || !aux || settings.mode !== ArtifactResolverMode.RULES_AUX) return rules;
  let timer: NodeJS.Timeout | undefined;
  try {
    const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), settings.auxTimeoutMs); });
    const reply = await Promise.race([aux.resolve(auxResolveRequest(input, settings.auxTimeoutMs)), deadline]);
    if (!reply || reply.confidence < settings.auxMinConfidence) return rules;
    const picked = byRef(input.artifacts, reply.refs);
    return picked.length > 0 ? { ...rules, picked, source: ResolvedRefSource.AUX, confidence: reply.confidence, ambiguous: false } : rules;
  } catch {
    return rules;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** `messages.resolved_refs` row for a resolution. */
export function toResolvedRefs(resolution: ResolveResult): ResolvedRefs {
  const shown = (resolution.ambiguous ? resolution.candidates.map((c) => c.artifact) : resolution.picked).slice().sort((a, b) => a.ordinal - b.ordinal);
  const scores: Record<string, number> = {};
  for (const c of resolution.candidates.slice(0, MAX_AMBIGUOUS_CANDIDATES + 1)) scores[c.alias] = c.score;
  return {
    ids: shown.map(artifactAlias),
    source: resolution.source,
    ...(Object.keys(scores).length > 0 ? { scores } : {}),
  };
}
