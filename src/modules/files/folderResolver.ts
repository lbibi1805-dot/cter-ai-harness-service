import type { ICanvasFileClient } from '../canvas/ports';
import { logger } from '../../utils/logger';

export interface ResolvedIoFolders {
  qFolder: { id: number; name: string; full_name: string; parent_folder_id: number | null };
  aFolder: { id: number; name: string; full_name: string; parent_folder_id: number | null };
}

/**
 * Resolves the Q (input) / A (output) subfolders inside the Materials folder for one
 * Canvas account — extracted from `PollOrchestrator.pollAccountInner` steps 1-2
 * (PLAN_MODULE_ARCHITECTURE.md mục 6 Phase 2 step 1). Behavior unchanged: creates the
 * output folder if missing, returns `null` (after logging) if Materials or the input
 * subfolder isn't found, in which case the caller skips the account for this poll.
 */
export async function resolveIoFolders(
  client: ICanvasFileClient,
  folders: { materials: string; input: string; output: string },
  accountIndex: number,
): Promise<ResolvedIoFolders | null> {
  const { materials: MATERIALS_FOLDER, input: INPUT_FOLDER, output: OUTPUT_FOLDER } = folders;

  const materialsFolder = await client.findFolderByPath(MATERIALS_FOLDER);
  if (!materialsFolder) {
    logger.folderSkip(accountIndex, `"${MATERIALS_FOLDER}" folder not found`);
    return null;
  }
  logger.folderFound(MATERIALS_FOLDER, materialsFolder.id);

  const subfolders = await client.listSubfolders(materialsFolder.id);
  const qFolder = subfolders.find((f) => f.name === INPUT_FOLDER);
  if (!qFolder) {
    logger.folderSkip(accountIndex, `"${INPUT_FOLDER}" subfolder not found inside ${MATERIALS_FOLDER}`);
    return null;
  }
  logger.folderFound(INPUT_FOLDER, qFolder.id);

  let aFolder = subfolders.find((f) => f.name === OUTPUT_FOLDER);
  if (!aFolder) {
    aFolder = await client.createFolder(materialsFolder.id, OUTPUT_FOLDER);
    logger.folderCreated(OUTPUT_FOLDER, aFolder.id);
  } else {
    logger.folderFound(OUTPUT_FOLDER, aFolder.id);
  }

  return { qFolder, aFolder };
}
