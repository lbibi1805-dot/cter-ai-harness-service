import { ObjectPrefix } from '../enums/objectStorage.enums';

/** Prefixes reported by `GET /api/storage/stats`. */
export const STORAGE_STATS_PREFIXES: readonly ObjectPrefix[] = [ObjectPrefix.VAULT, ObjectPrefix.CONVERSATIONS, ObjectPrefix.DERIVED];
