/** PNG bytes, or the syntax error PlantUML reported for the source (fed back to the repair agent). */
export interface DiagramRender {
  png?: Buffer;
  syntaxError?: string;
  errorLine?: number;
}

/** Renders PlantUML source; transport failures throw, syntax errors come back in the result. */
export interface DiagramRenderer {
  render(puml: string): Promise<DiagramRender>;
}
