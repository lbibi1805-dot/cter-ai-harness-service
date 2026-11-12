import { withTimeout } from '../../../shared/resilience';
import { extractPlantUmlBlocks } from '../../../shared/text';
import type { AIInvocationService, AIProvider } from '../../ai';
import type { DiagramRepairer, DiagramRepairRequest } from '../domain';
import { describeSyntaxError } from './tools/validateDiagram.tool';
import { DIAGRAM_REPAIR_INSTRUCTIONS, DIAGRAM_REPAIR_MAX_OUTPUT_TOKENS, DIAGRAM_REPAIR_PURPOSE } from './constants/diagramRepair.constants';

/**
 * One aux-model call per broken block (12/11 plan 03 §5): system = the diagram-syntax policy
 * (`prompts/policies/diagram-syntax.md`), user = block + error + line. Returns the corrected source only.
 */
export class AiDiagramRepairer implements DiagramRepairer {
  constructor(
    private readonly invocation: AIInvocationService,
    private readonly provider: AIProvider,
    private readonly model: string,
    private readonly syntaxPolicy: string,
    private readonly now: () => number = Date.now,
  ) {}

  async repair(request: DiagramRepairRequest): Promise<string | null> {
    const text = `${DIAGRAM_REPAIR_INSTRUCTIONS}\n\n${describeSyntaxError(request.source, request.error, request.line)}\n\nSource:\n\`\`\`plantuml\n${request.source}\n\`\`\``;
    const content = { textContent: text, imageBuffers: [] };
    const budget = request.deadlineAt - this.now();
    if (budget <= 0) return null;
    const answer = await withTimeout(
      this.invocation.answerPrepared(
        {
          provider: this.provider, model: this.model, content, label: `${request.label}-diagram-repair`,
          deadlineAt: request.deadlineAt, purpose: DIAGRAM_REPAIR_PURPOSE, maxOutputTokens: DIAGRAM_REPAIR_MAX_OUTPUT_TOKENS,
        },
        { systemPrompt: this.syntaxPolicy, content, contexts: [] },
      ),
      budget,
      `${request.label}-diagram-repair`,
    );
    return extractPlantUmlBlocks(answer.text)[0] ?? null;
  }
}
