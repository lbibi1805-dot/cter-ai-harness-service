/** Result of rendering one PlantUML source (12/11 plan 03). */
export interface DiagramCheck {
  ok: boolean;
  /** PlantUML's syntax error (X-PlantUML-Diagram-Error) when `ok` is false. */
  error?: string;
  /** 1-based line of the error in the normalized source, when PlantUML reports it. */
  line?: number;
  /**
   * Connectivity lint of a C4 block (12/11 plan 04 §4.3: orphan elements, split diagram, one-sided queue);
   * absent when DIAGRAM_CONNECTIVITY_CHECK=false or the block is not C4. `ok` is about rendering only.
   */
  connectivity?: DiagramConnectivity;
}

/** One connectivity finding (same shape as the C4 module's ConnectivityIssue). */
export interface DiagramConnectivityIssue {
  code: string;
  message: string;
  elementIds: string[];
}

export interface DiagramConnectivity {
  errors: DiagramConnectivityIssue[];
  warnings: DiagramConnectivityIssue[];
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
