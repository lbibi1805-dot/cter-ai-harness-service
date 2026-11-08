import { containsWord, hasDiacritics, maskCompounds, normalizeText, stripDiacritics } from '../../context';
import {
  ACCENT_FREE_COLLISIONS,
  COMMAND_HEAD_WORDS,
  DRAWN_REFERENCE_PHRASES,
  DRAW_WORDS,
  INTENT_CONFIDENCE,
  REVIEW_WORDS,
  REVISE_WORDS,
  SHORT_COMMAND_CHARS,
} from './constants/routing.constants';
import { IntentSource, RequestIntent } from './enums/routing.enums';
import type { IntentCues, IntentDecision, IntentInput } from './interfaces/routing.interface';

/** The part of the text that can hold a command: all of a short text, the first words of a long one. */
export function commandText(text: string): string {
  const trimmed = normalizeText(text).trim();
  if (trimmed.length <= SHORT_COMMAND_CHARS) return trimmed;
  return trimmed.split(/\s+/).slice(0, COMMAND_HEAD_WORDS).join(' ');
}

/** Whole-word (Unicode) command cues; accent-free text is matched accent-insensitively. */
export function intentCues(text: string): IntentCues {
  const raw = commandText(text);
  const plain = !hasDiacritics(raw);
  const forms = (words: readonly string[]) => (plain
    ? words.map(stripDiacritics).filter((w) => !ACCENT_FREE_COLLISIONS.includes(w))
    : words);
  const head = maskCompounds(raw, forms(DRAWN_REFERENCE_PHRASES));
  const has = (words: readonly string[]) => containsWord(head, forms(words));
  return { review: has(REVIEW_WORDS), revise: has(REVISE_WORDS), draw: has(DRAW_WORDS) };
}

function decide(intent: RequestIntent, confidence: number, source: IntentSource, reason: string): IntentDecision {
  return { intent, confidence, source, reason };
}

/**
 * Intent rules (note 05 §2): explicit intent → `--review` flag → keywords in the head of the text
 * combined with "are there images" and "is there a design in the conversation". Null = the rules cannot
 * decide (the caller asks the aux model, once, together with the artifact refs).
 */
export function classifyIntent(input: IntentInput): IntentDecision | null {
  const { RULE, FLAG, EXPLICIT } = IntentSource;
  if (input.explicitIntent) return decide(input.explicitIntent, INTENT_CONFIDENCE.explicit, EXPLICIT, 'client intent');
  const cues = intentCues(input.text);
  const hasDesign = input.designCount > 0 || input.refCount > 0;
  const somethingToReview = hasDesign || input.imageCount > 0;

  if (!input.slash && !input.reviewFlag) {
    // Chat path: Q&A unless it clearly asks to review a design it has.
    if (cues.review && somethingToReview) return null;
    return decide(RequestIntent.QA, INTENT_CONFIDENCE.rule, RULE, 'no /c4');
  }
  if (input.reviewFlag) {
    if (cues.draw || !somethingToReview) return decide(RequestIntent.C4_GENERATE_AND_REVIEW, INTENT_CONFIDENCE.flag, FLAG, '--review + draw');
    return decide(RequestIntent.C4_REVIEW, INTENT_CONFIDENCE.flag, FLAG, '--review');
  }
  if (cues.review && cues.draw) return decide(RequestIntent.C4_GENERATE_AND_REVIEW, INTENT_CONFIDENCE.rule, RULE, 'draw + review words');
  if (cues.review && cues.revise) return hasDesign ? null : decide(RequestIntent.C4_REVIEW, INTENT_CONFIDENCE.weakRule, RULE, 'review words');
  if (cues.review) {
    return somethingToReview
      ? decide(RequestIntent.C4_REVIEW, INTENT_CONFIDENCE.rule, RULE, 'review words')
      : decide(RequestIntent.C4_GENERATE_AND_REVIEW, INTENT_CONFIDENCE.weakRule, RULE, 'review words, nothing drawn yet');
  }
  if (cues.revise && hasDesign) {
    // New problem pages + "thêm …": a new statement or a change of the old design?
    if (input.imageCount > 0) return null;
    return decide(RequestIntent.C4_REVISE, INTENT_CONFIDENCE.rule, RULE, 'revise words + existing design');
  }
  if (input.refCount > 0 && !cues.draw) return null;
  return decide(RequestIntent.C4_GENERATE, hasDesign && !cues.draw ? INTENT_CONFIDENCE.weakRule : INTENT_CONFIDENCE.rule, RULE, 'draw');
}

/** When neither the rules nor the aux model decided: revise when it says so and a design exists, else generate. */
export function fallbackIntent(input: IntentInput): IntentDecision {
  if (!input.slash) return decide(RequestIntent.QA, INTENT_CONFIDENCE.fallback, IntentSource.DEFAULT, 'default');
  const cues = intentCues(input.text);
  const hasDesign = input.designCount > 0 || input.refCount > 0;
  if (cues.review) return decide(hasDesign || input.imageCount > 0 ? RequestIntent.C4_REVIEW : RequestIntent.C4_GENERATE_AND_REVIEW, INTENT_CONFIDENCE.fallback, IntentSource.DEFAULT, 'default');
  if (hasDesign && (cues.revise || input.refCount > 0)) return decide(RequestIntent.C4_REVISE, INTENT_CONFIDENCE.fallback, IntentSource.DEFAULT, 'default');
  return decide(RequestIntent.C4_GENERATE, INTENT_CONFIDENCE.fallback, IntentSource.DEFAULT, 'default');
}
