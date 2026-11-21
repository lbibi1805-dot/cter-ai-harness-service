import type { AIInvocationService, AIProvider } from '../../ai';
import type { ConversationService, ConversationStore } from '../../conversation-store';
import type { ContextJobs } from '../application/contextJobs.service';
import type { ConversationTurnService } from '../application/conversationTurn.service';
import type { C4ConversationRecorderAdapter } from '../application/c4ConversationRecorder';
import type { AuxTimeouts } from '../application/interfaces/contextJobs.interface';
import type { AuxResolver } from '../domain/interfaces/artifactResolver.interface';
import type { AuxModel } from '../domain/interfaces/auxModel.port';
import type { ContextSettings } from '../domain/interfaces/context.interface';

export interface ContextConfig {
  settings: ContextSettings;
  /** AUX_PROVIDER / AUX_MODEL: captions, OCR, summaries, query rewriting, design notes. */
  aux: { provider: AIProvider; model: string };
  timeouts: AuxTimeouts;
  /** Base of layer ① (static); the hash of the full static prefix is the message's `prompt_version`. */
  systemPrompt: string;
}

export interface ContextDeps {
  invocation: AIInvocationService;
  store: ConversationStore;
  conversations: ConversationService;
  isProviderConfigured: (provider: AIProvider) => boolean;
  /** Test hook. */
  auxModel?: AuxModel | null;
  /** Step ③ of the artifact resolver (note 17 §3.3, provided with the intent router of note 05); none = rules only. */
  auxResolver?: AuxResolver | null;
}

export interface ContextModule {
  turns: ConversationTurnService;
  c4Recorder: C4ConversationRecorderAdapter;
  jobs: ContextJobs;
  promptVersion: string;
}
