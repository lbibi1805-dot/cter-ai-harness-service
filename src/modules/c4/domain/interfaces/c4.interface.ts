import type { C4Direction, C4ElementKind, C4ElementVariant, C4Level } from '../enums/c4.enums';

/** A requirement found in the problem statement; `levels` are the diagrams that must show it (empty = all). */
export interface C4Requirement {
  id: string;
  text: string;
  levels: C4Level[];
}

export interface C4Element {
  id: string;
  kind: C4ElementKind;
  variant: C4ElementVariant;
  external: boolean;
  name: string;
  desc: string;
  tech?: string;
  /** Id of the enclosing boundary. */
  parent?: string;
  /** Requirement ids this element demonstrates. */
  covers: string[];
}

export interface C4Relationship {
  from: string;
  to: string;
  label: string;
  tech?: string;
  dir?: C4Direction;
  /** Sequence only: a change of phase emits a `== phase ==` divider. */
  phase?: string;
  covers: string[];
}

export interface C4DiagramSpec {
  title: string;
  elements: C4Element[];
  rels: C4Relationship[];
}

/** A validated, auto-fixed spec plus what is still wrong with it. */
export interface C4Validation {
  spec: C4DiagramSpec;
  errors: string[];
  covered: string[];
  missing: string[];
  /** Lower is better (errors + uncovered requirements); a revision must not raise it. */
  score: number;
}

/** An actor or external system of the architect's shared model. */
export interface C4ModelElement {
  id: string;
  name: string;
}

export interface C4ValidationRules {
  maxElements: number;
  /** Actors and external systems that context and container diagrams must show (C4: same people/systems at both levels). */
  requiredElements?: readonly C4ModelElement[];
}

/** An element kind as the model wrote it, plus the variant the alias implies. */
export interface C4KindParse {
  kind: C4ElementKind;
  impliedVariant?: C4ElementVariant;
}
