import * as crypto from 'crypto';
import { logger } from '../../shared/logging/logger';
import { PromptCacheLayout } from '../ai/domain/enums/promptLayout.enums';
import { ContextJobs } from './application/contextJobs.service';
import { ConversationTurnService } from './application/conversationTurn.service';
import { C4ConversationRecorderAdapter } from './application/c4ConversationRecorder';
import { AiInvocationAuxModel } from './infrastructure/aiAuxModel.adapter';
import type { ContextConfig, ContextDeps, ContextModule } from './interfaces/contextModule.interface';

export type { ContextConfig, ContextDeps, ContextModule } from './interfaces/contextModule.interface';

/** sha256 prefix of the static system prompt: stable across requests = cacheable prefix. */
export function promptVersionOf(systemPrompt: string): string {
  return crypto.createHash('sha256').update(systemPrompt).digest('hex').slice(0, 12);
}

/**
 * The static layer ① the answering model actually gets: the registry composition as is, in both layouts
 * (12/11 02 Bước 2: the code appends no rule text). `layout` is kept for callers.
 */
export function staticPrefixOf(systemPrompt: string, _layout?: PromptCacheLayout): string {
  return systemPrompt;
}

/** Context engineering for the API path: Context Assembler, artifact resolver, artifact memory, auto-compact. */
export function createContextModule(config: ContextConfig, deps: ContextDeps): ContextModule {
  const aux = deps.auxModel !== undefined
    ? deps.auxModel
    : deps.isProviderConfigured(config.aux.provider) ? new AiInvocationAuxModel(deps.invocation, config.aux.provider, config.aux.model) : null;
  if (!aux) logger.info(`[context] aux model ${config.aux.provider}/${config.aux.model} not configured — no captions/OCR/auto-compact (history is truncated instead)`);
  const promptVersion = promptVersionOf(staticPrefixOf(config.systemPrompt, config.settings.promptLayout));
  const { resolver } = config.settings;
  logger.info(`[context] prompt layout ${config.settings.promptLayout}, prefix hash ${promptVersion}, artifact resolver ${resolver.mode}${deps.auxResolver ? ' (aux resolver on)' : ''}${aux ? `, aux model ${aux.name}` : ''}`);
  const jobs = new ContextJobs(aux, deps.store, config.settings, config.timeouts);
  const turns = new ConversationTurnService(deps.store, deps.conversations, jobs, config.settings, promptVersion, config.timeouts, deps.auxResolver ?? null);
  return { turns, jobs, promptVersion, c4Recorder: new C4ConversationRecorderAdapter(turns) };
}

export { ConversationTurnService } from './application/conversationTurn.service';
export { C4ConversationRecorderAdapter, summarize as summarizeC4Run } from './application/c4ConversationRecorder';
export { ContextJobs, parseImageNote } from './application/contextJobs.service';
export * from './domain/contextAssembler';
export {
  extractSignals,
  hasStrongSignal,
  entityMatch,
  scoreCandidates,
  resolveArtifacts,
  resolveArtifactsWithAux,
  auxResolveRequest,
  toResolvedRefs,
} from './domain/artifactResolver';
export { artifactAlias, artifactLabel, displayLabel, inferVersion, levelsOf, ownerOf, specLevels, systemNameOf, elementNames } from './domain/artifactMetadata';
export { isDesignQuestion, isDesignAnswer, heuristicDesignNote, parseDesignNote } from './domain/designNote';
export { DEFAULT_CONTEXT_SETTINGS, DEFAULT_PINNED_KINDS, DEFAULT_HOT_WINDOW_TURNS, DEFAULT_MAX_PROMPT_IMAGES, HOT_WINDOW_MAX_IMAGES_PER_TURN } from './domain/constants/context.constants';
export { DEFAULT_RESOLVER_SETTINGS, RESOLVER_WEIGHTS } from './domain/constants/artifactResolver.constants';
export { ArtifactResolverMode, ArtifactPart, ArtifactToolName, TemporalCue } from './domain/enums/context.enums';
export type { ContextSettings, AssembledContext, ImageNote, DesignNoteData, HotWindowSlot } from './domain/interfaces/context.interface';
export type {
  AuxResolver,
  AuxResolveRequest,
  AuxResolveReply,
  AuxRegistryEntry,
  ReferenceSignals,
  ResolveInput,
  ResolveResult,
  ResolverSettings,
  ScoredCandidate,
  ScoreBreakdown,
} from './domain/interfaces/artifactResolver.interface';
export type { AuxModel, AuxCall } from './domain/interfaces/auxModel.port';
export type { AuxTimeouts, DesignNoteJob } from './application/interfaces/contextJobs.interface';
export type { RecordedArtifact, TurnRecordInput } from './application/interfaces/conversationTurn.interface';
export { createArtifactTools, ListArtifactsTool, GetArtifactTool, type ArtifactSnapshotProvider } from './infrastructure/agentTools/artifactTools';
export { containsWord, hasDiacritics, maskCompounds, normalizeText, stripDiacritics, tokenize } from './domain/helpers/textMatch.helper';
