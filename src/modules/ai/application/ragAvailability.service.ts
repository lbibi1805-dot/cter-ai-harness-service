import { RagPipeline } from './interfaces/promptPreparer.interface';

/**
 * RAG becomes available asynchronously, after the vault finishes indexing at
 * startup. Callers read `current()` on every request instead of keeping a
 * snapshot, so the switch reaches every flow without re-wiring.
 */
export class RagAvailability {
  private pipeline: RagPipeline | null = null;

  markReady(pipeline: RagPipeline): void {
    this.pipeline = pipeline;
  }

  current(): RagPipeline | null {
    return this.pipeline;
  }
}
