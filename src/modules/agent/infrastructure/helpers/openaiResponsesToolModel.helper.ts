import { ToolChoice, type TurnOptions } from '../../domain';

export function toolChoiceFor({ allowTools, requireTool = false }: TurnOptions): ToolChoice {
  if (!allowTools) return ToolChoice.NONE;
  return requireTool ? ToolChoice.REQUIRED : ToolChoice.AUTO;
}
