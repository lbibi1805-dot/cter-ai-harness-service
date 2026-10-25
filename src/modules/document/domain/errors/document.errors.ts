import { ConfigurationError } from '../../../../shared/errors';

/** A browser-side rendering asset (Mermaid, KaTeX) is missing from node_modules. */
export class DocumentAssetMissingError extends ConfigurationError {}
