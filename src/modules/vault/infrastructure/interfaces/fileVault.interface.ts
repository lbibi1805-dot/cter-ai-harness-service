import type { VaultEntry } from '../../domain';

/** A manifest entry as stored in the JSON file (keyed by file path). Every field optional: older files lack most. */
export type StoredEntry = Partial<Omit<VaultEntry, 'filePath' | 'folderPath' | 'depth'>> & {
  /** Legacy: markdown kept inline before object storage. Ignored (re-upload needed). */
  content?: string;
};

export interface ManifestFile {
  files?: Record<string, StoredEntry>;
}
