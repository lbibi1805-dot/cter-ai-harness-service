import { logger } from '../../shared/logging/logger';
import { EssayService } from './application/essay.service';
import type { EssayServiceDeps } from './application/interfaces/essayService.interface';
import type { EssaySettings } from './domain/interfaces/essay.interface';

/** Builds Essay Mode (15); only wired when retrieval (Pinecone) is configured. */
export function createEssayModule(settings: EssaySettings, deps: EssayServiceDeps): EssayService {
  logger.info(`[essay] ready — auto-detect ${settings.autoDetect ? 'on' : 'off'}, ${settings.maxChunks} chunks, ${settings.wordsPerPoint} words/point, self-check ${settings.selfCheck ? 'always' : 'strict only'}, thinking ${settings.thinkingLevel}${deps.aux ? `, aux ${deps.aux.provider}/${deps.aux.model}` : ', heuristic analysis (no aux)'}`);
  return new EssayService(settings, deps);
}

export { EssayService } from './application/essay.service';
export { VaultExemplarSource } from './infrastructure/vaultExemplarSource';
export type { EssayAnswer, EssayAnalysisSource, EssayRequest, EssayServiceDeps, ExemplarSource, EssayInvocation, SharedEssayAnalysis } from './application/interfaces/essayService.interface';
export * from './domain/enums/essay.enums';
export * from './domain/constants/essay.constants';
export type { EssayGoldenAnswer, EssayGoldenCase, EssayGoldenScore } from './domain/interfaces/essay.interface';
export { scoreEssayCase } from './domain/helpers/essayEval.helper';
export type { EssayAnalysis, EssayDetails, EssayRequestOptions, EssaySettings, ParsedEssayCommand } from './domain/interfaces/essay.interface';
export { detectEssayQuestion, detectVerbs, extractQuestionPoints, parseEssayCommand } from './domain/helpers/essayCommand.helper';
export { essayOutputTokens, heuristicAnalysis, parseAnalysisObject, parseAnalysisReply, targetWordsFor } from './domain/helpers/essayAnalysis.helper';
export { EssayStreamFilter, checkCitations, countWords, dropUnknownCitations, splitEssayOutput, stripCitationMarkers } from './domain/helpers/essayOutput.helper';
export { selectEssayChunks } from './domain/helpers/essaySelection.helper';
