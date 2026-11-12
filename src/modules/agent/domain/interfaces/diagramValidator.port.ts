/** Result of rendering one PlantUML source (12/11 plan 03). */
export interface DiagramCheck {
  ok: boolean;
  /** PlantUML's syntax error (X-PlantUML-Diagram-Error) when `ok` is false. */
  error?: string;
  /** 1-based line of the error in the normalized source, when PlantUML reports it. */
  line?: number;
}

/** Renders PlantUML (C4RenderService: RAM cache + PlantUML server). Throws when the renderer itself fails. */
export interface DiagramValidator {
  validate(source: string): Promise<DiagramCheck>;
}

export interface DiagramRepairRequest {
  source: string;
  error: string;
  line?: number;
  /** Epoch ms: the repair call must finish before it. */
  deadlineAt: number;
  label: string;
}

/** One aux-model call: broken block + error → corrected PlantUML source only (null when it gave nothing usable). */
export interface DiagramRepairer {
  repair(request: DiagramRepairRequest): Promise<string | null>;
}
