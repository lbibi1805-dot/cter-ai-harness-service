/** C4 diagram levels the sketcher can draw (C4-PlantUML include per level). */
export enum C4Level {
  CONTEXT = 'context',
  CONTAINER = 'container',
  COMPONENT = 'component',
  SEQUENCE = 'sequence',
}

export enum C4ElementKind {
  PERSON = 'person',
  SYSTEM = 'system',
  CONTAINER = 'container',
  COMPONENT = 'component',
  SYSTEM_BOUNDARY = 'system_boundary',
  CONTAINER_BOUNDARY = 'container_boundary',
  BOUNDARY = 'boundary',
}

export enum C4ElementVariant {
  STANDARD = 'standard',
  DB = 'db',
  QUEUE = 'queue',
}

/** Layout hint, rendered as Rel_U/Rel_D/Rel_L/Rel_R. */
export enum C4Direction {
  UP = 'U',
  DOWN = 'D',
  LEFT = 'L',
  RIGHT = 'R',
}
