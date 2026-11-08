/** One chunk as MiniSearch indexes it: the accented text and a copy without diacritics. */
export interface LexicalIndexDocument {
  id: string;
  text: string;
  plain: string;
}
