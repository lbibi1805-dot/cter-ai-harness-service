export interface MarkdownSection {
  heading: string;
  parentHeading: string;
  content: string;
}

/** Hands out globally increasing chunk numbers across files of one indexing run. */
export type ChunkCounter = () => number;
