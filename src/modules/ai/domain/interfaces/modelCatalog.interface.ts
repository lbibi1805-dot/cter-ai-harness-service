import type { AiConfig } from './aiConfig.interface';

export type ModelCatalogConfig = Pick<AiConfig, 'defaultModels' | 'modelFallback' | 'openRouter'>;
