import { ValidationError } from '../../../../shared/errors';

export class VaultPathEscapesRootError extends ValidationError {
  constructor(filePath: string) {
    super(`Vault path escapes root: ${filePath}`);
  }
}
