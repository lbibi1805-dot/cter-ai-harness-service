/**
 * `modules/canvas` DTOs — Canvas API entities crossing the module boundary. Moved
 * from `src/types.ts` per docs/types-classification.md (Phase 1, mục 3.1 / mục 6
 * Phase 1 step 3). Behavior unchanged (identical shapes).
 */
export interface CanvasFolder {
  id: number;
  name: string;
  full_name: string;
  parent_folder_id: number | null;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  url: string;
  size: number;
  updated_at: string;
}
