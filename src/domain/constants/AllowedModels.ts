// Re-export from config for domain layer — single source of truth will move here in Phase 4
export { ALLOWED_MODELS, isValidModel, getModelApiMode } from '../../config/allowedModels';
export type { OpenAIApiMode } from '../enums/EmbeddingProvider';
