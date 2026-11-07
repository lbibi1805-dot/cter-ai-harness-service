export interface MarkdownSection {
  heading: string;
  parentHeading: string;
  content: string;
}

/** Hands out the next chunk id of one document (`<docId>#<hash8>#<idx>`). */
export type ChunkIdFactory = () => string;
