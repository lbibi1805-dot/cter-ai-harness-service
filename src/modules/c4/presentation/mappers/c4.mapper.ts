import { ValidationError } from '../../../../shared/errors';
import { AI_PROVIDERS, AIProvider, parseAIProvider } from '../../../ai';
import { assertInlineImageBudget, parseImages, parseRefArtifactIds } from '../../../chat/presentation/helpers/chat.helper';
import { ClientIntent, CLIENT_INTENTS, RequestIntent, type IntentDecision } from '../../../routing';
import { briefLevels, briefSummary, C4_LEVEL_ORDER, parseC4Level, type C4Level, type ProblemBrief } from '../../domain';
import type {
  C4ArchitectPlan,
  C4Clarify,
  C4DiscussionResult,
  C4LevelResult,
  C4ResumeRequest,
  C4ReviewResult,
  C4SketchRequest,
  C4SketchResult,
} from '../../application/interfaces/c4Sketch.interface';
import { C4_GEMINI_INLINE_IMAGES_MAX_BYTES, MAX_DESCRIPTION_CHARS } from '../constants/c4.constants';
import type { C4AnalysisDto, C4BriefDto, C4ClarifyDto, C4DiscussionDto, C4IntentDto, C4LevelDto, C4ReviewDto, C4SketchDto } from '../dto/c4.dto';

const CLIENT_INTENT_VALUES = new Set<string>(Object.values(ClientIntent));
const REQUEST_INTENT_VALUES = new Set<string>(Object.values(RequestIntent));

/** `intent`: omitted/"auto" = the router decides; client names or the internal intent names. */
function parseIntent(raw: unknown): RequestIntent | null {
  if (raw === undefined || raw === null) return null;
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (CLIENT_INTENT_VALUES.has(value)) return CLIENT_INTENTS[value as ClientIntent];
  if (REQUEST_INTENT_VALUES.has(value) && value !== RequestIntent.QA) return value as RequestIntent;
  throw new ValidationError(`intent must be one of ${[...CLIENT_INTENT_VALUES].join(', ')}`);
}

/** Shape validation of a `POST /api/c4` body; model rules are checked by C4SketchService. */
export function toC4SketchRequest(body: unknown): C4SketchRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;

  const rawProvider = typeof raw.provider === 'string' ? raw.provider.trim().toLowerCase() : '';
  if (!rawProvider) throw new ValidationError('Missing provider');
  const provider = parseAIProvider(rawProvider);
  if (!provider) throw new ValidationError(`Provider "${rawProvider}" is not servable (supported: ${AI_PROVIDERS.join(', ')})`);

  const images = parseImages(raw.images);
  if (provider === AIProvider.GEMINI) assertInlineImageBudget(images, C4_GEMINI_INLINE_IMAGES_MAX_BYTES, provider);
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (!description && images.length === 0) throw new ValidationError('Missing description (the problem statement) or images of it');
  if (description.length > MAX_DESCRIPTION_CHARS) throw new ValidationError(`description is longer than ${MAX_DESCRIPTION_CHARS} characters`);

  const rawLevels = raw.levels ?? [];
  if (!Array.isArray(rawLevels)) throw new ValidationError('levels must be an array');
  const levels = rawLevels.map((value, i) => {
    const level = parseC4Level(value);
    if (!level) throw new ValidationError(`levels[${i}] must be one of ${C4_LEVEL_ORDER.join(', ')}`);
    return level;
  });

  const model = typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : undefined;
  const conversationId = typeof raw.conversationId === 'string' && raw.conversationId.trim() ? raw.conversationId.trim() : undefined;
  const intent = parseIntent(raw.intent);
  const refArtifactIds = parseRefArtifactIds(raw.refArtifactIds);
  return {
    provider,
    requestedModel: model,
    description,
    levels: [...new Set<C4Level>(levels)],
    fast: raw.fast === true,
    stream: raw.stream === true,
    images,
    review: raw.review === true,
    ...(raw.noDiscussion === true ? { noDiscussion: true } : {}),
    ...(intent ? { intent } : {}),
    ...(refArtifactIds.length ? { refArtifactIds } : {}),
    ...(conversationId ? { conversationId } : {}),
  };
}

/** Shape validation of a `POST /api/c4/resume` body. */
export function toC4ResumeRequest(body: unknown): C4ResumeRequest {
  if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object');
  const raw = body as Record<string, unknown>;
  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  if (!sessionId) throw new ValidationError('Missing sessionId');
  const answers = typeof raw.answers === 'string' ? raw.answers.trim() : '';
  if (answers.length > MAX_DESCRIPTION_CHARS) throw new ValidationError(`answers is longer than ${MAX_DESCRIPTION_CHARS} characters`);
  return { sessionId, answers: answers || undefined, stream: raw.stream === true };
}

function secondsUntil(epochMs: number, now: number): number {
  return Math.max(0, Math.round((epochMs - now) / 1000));
}

export function toC4SketchDto(result: C4SketchResult, now: number = Date.now()): C4SketchDto {
  return {
    provider: result.provider,
    model: result.model,
    systemName: result.systemName,
    requirements: result.requirements,
    knowledgeSources: result.knowledgeSources,
    levels: result.levels.map(toC4LevelDto),
    durationMs: result.elapsedMs,
    deadlineHit: result.deadlineHit,
    conversationId: result.conversationId ?? null,
    messageId: result.messageId ?? null,
    confirmation: result.confirmation
      ? {
          sessionId: result.confirmation.sessionId,
          clarifications: result.confirmation.clarifications,
          expiresInSec: secondsUntil(result.confirmation.expiresAt, now),
        }
      : null,
    ...(result.intent ? { intent: toC4IntentDto(result.intent) } : {}),
    ...(result.brief ? { brief: toC4BriefDto(result.brief) } : {}),
    ...(result.review !== undefined ? { review: result.review ? { markdown: result.review.markdown } : null } : {}),
    ...(result.discussion !== undefined ? { discussion: result.discussion ? toC4DiscussionDto(result.discussion) : null } : {}),
    ...(result.artifacts?.length ? { artifacts: result.artifacts } : {}),
    ...(result.criticNotes?.length ? { criticNotes: result.criticNotes } : {}),
  };
}

export function toC4LevelDto(level: C4LevelResult): C4LevelDto {
  return {
    level: level.level,
    ok: !!level.png,
    title: level.title ?? null,
    png: level.png ? level.png.toString('base64') : null,
    puml: level.puml ?? null,
    elementCount: level.elementCount,
    covered: level.covered,
    missing: level.missing,
    notes: level.notes,
    error: level.error ?? null,
    connectivity: { errors: level.connectivity?.errors ?? [], warnings: level.connectivity?.warnings ?? [] },
  };
}

export function toC4DiscussionDto(discussion: C4DiscussionResult): C4DiscussionDto {
  return { markdown: discussion.markdown, ...(discussion.artifactId ? { artifactId: discussion.artifactId } : {}), ...(discussion.alias ? { alias: discussion.alias } : {}) };
}

export function toC4AnalysisDto(plan: C4ArchitectPlan, knowledgeSources: string[]): C4AnalysisDto {
  return { systemName: plan.systemName, requirements: plan.requirements, clarifications: plan.clarifications, knowledgeSources };
}

export function toC4IntentDto(decision: IntentDecision): C4IntentDto {
  return { intent: decision.intent, confidence: Math.round(decision.confidence * 100) / 100, source: decision.source };
}

export function toC4BriefDto(brief: ProblemBrief): C4BriefDto {
  return {
    systemName: brief.systemName.value,
    summary: briefSummary(brief),
    actors: brief.actors.value,
    externalSystems: brief.externalSystems.value,
    levels: briefLevels(brief),
  };
}

export function toC4ClarifyDto(clarify: C4Clarify, now: number = Date.now()): C4ClarifyDto {
  return { sessionId: clarify.sessionId, summary: clarify.summary, questions: clarify.questions, expiresInSec: secondsUntil(clarify.expiresAt, now) };
}

export function toC4ReviewDto(review: C4ReviewResult): C4ReviewDto {
  return { markdown: review.markdown, ...(review.artifactId ? { artifactId: review.artifactId } : {}), ...(review.alias ? { alias: review.alias } : {}) };
}
