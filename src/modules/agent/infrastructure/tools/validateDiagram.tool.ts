import { normalizePlantUmlSource } from '../../../../shared/text';
import { AgentToolName, InvalidToolArgumentsError, ToolBudgetGroup, stringArg, type AgentTool, type DiagramValidator, type ToolResult } from '../../domain';
import { ERROR_CONTEXT_LINES, VALIDATE_DIAGRAM_OK } from '../constants/validateDiagram.constants';

/** `SYNTAX ERROR line N: message` + the lines around N (numbered), so the model can fix the right line. */
export function describeSyntaxError(source: string, error: string, line?: number): string {
  if (!line) return `SYNTAX ERROR: ${error}`;
  const lines = normalizePlantUmlSource(source).split('\n');
  const from = Math.max(1, line - ERROR_CONTEXT_LINES);
  const to = Math.min(lines.length, line + ERROR_CONTEXT_LINES);
  const context = lines.slice(from - 1, to).map((text, i) => `${from + i === line ? '>' : ' '} ${from + i}: ${text}`).join('\n');
  return `SYNTAX ERROR line ${line}: ${error}\n${context}`;
}

/**
 * Agent tool (12/11 plan 03 §4): renders one PlantUML block through the diagram validator. Counted against
 * AGENT_MAX_DIAGRAM_VALIDATIONS, not the research budget. Read-only; renderer failures become a tool error.
 */
export class ValidateDiagramTool implements AgentTool {
  readonly name = AgentToolName.VALIDATE_DIAGRAM;
  readonly budgetGroup = ToolBudgetGroup.DIAGRAM;
  readonly description = 'Render a PlantUML / C4-PlantUML block and report OK or the syntax error with its line. Call it on every PlantUML block before the final answer.';
  readonly parameters = {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'The full PlantUML source, from @startuml to @enduml.' },
      language: { type: 'string', enum: ['plantuml'], description: 'Diagram language (only plantuml is supported).' },
    },
    required: ['source'],
    additionalProperties: false,
  };

  constructor(private readonly validator: DiagramValidator) {}

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const source = stringArg(args, 'source');
    if (!source) throw new InvalidToolArgumentsError('"source" is required');
    const check = await this.validator.validate(source);
    return { content: check.ok ? VALIDATE_DIAGRAM_OK : describeSyntaxError(source, check.error ?? 'unknown error', check.line), sources: [] };
  }
}
