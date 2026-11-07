import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR_NAME, MANIFEST_FILE_NAME } from '../constants/fileVault.constants';

export function resolveManifestPath(rootDir: string, rootManifest: string): string {
  const dataDir = path.resolve(rootDir, DATA_DIR_NAME);
  if (!fs.existsSync(dataDir)) return rootManifest;
  const dataManifest = path.join(dataDir, MANIFEST_FILE_NAME);
  if (!fs.existsSync(dataManifest) && fs.existsSync(rootManifest)) {
    try {
      fs.copyFileSync(rootManifest, dataManifest);
    } catch {
      // Falls back to an empty manifest under data/.
    }
  }
  return dataManifest;
}

export function isInFolder(filePath: string, folder: string): boolean {
  return filePath === folder || filePath.startsWith(`${folder}/`);
}
