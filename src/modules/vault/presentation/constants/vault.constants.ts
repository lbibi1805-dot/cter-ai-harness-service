import { AUTO_INDEX_DEBOUNCE_MS } from '../../application/constants/vaultIndexing.constants';
import { PageLimits } from '../dto/vault.dto';

export const RETRY_AFTER_SECONDS = AUTO_INDEX_DEBOUNCE_MS / 1000;

export const FILE_PAGE_LIMITS: PageLimits = { defaultLimit: 50, maxLimit: 1000 };

export const CHUNK_PAGE_LIMITS: PageLimits = { defaultLimit: 50, maxLimit: 100 };

/** Multipart fields that may carry a client-side relative path (folder upload). */
export const RELATIVE_PATH_FIELDS = ['path', 'webkitRelativePath'] as const;

export const VAULT_API_PREFIX = '/api/vault';
