import type { LexicalSearch } from '../../retrieval';
import { EXEMPLAR_FOLDER, EXEMPLAR_MAX_CHARS } from '../domain/constants/essay.constants';
import type { ExemplarSource } from '../application/interfaces/essayService.interface';

/**
 * Model essays live in the vault under `_exemplars/<course>/` (15 §4.3). The closest one to the question is
 * picked with the in-RAM BM25 index (no extra query cost) and read from object storage. Absent folder,
 * no lexical index or no match = no exemplar.
 */
export class VaultExemplarSource implements ExemplarSource {
  constructor(
    private readonly lexical: LexicalSearch,
    private readonly readDocument: (filePath: string) => Promise<string | null>,
  ) {}

  async find(course: string, question: string): Promise<string | null> {
    const prefix = `${EXEMPLAR_FOLDER}${course}/`;
    const [best] = this.lexical.search(question, 1, { sourceFilter: (source) => source.startsWith(prefix) });
    if (!best) return null;
    const content = await this.readDocument(best.source);
    return content ? content.slice(0, EXEMPLAR_MAX_CHARS) : null;
  }
}
