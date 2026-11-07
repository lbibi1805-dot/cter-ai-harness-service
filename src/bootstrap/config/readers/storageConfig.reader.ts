import { readOptionalString, readString } from '../../../shared/config/env';
import { ConfigurationError } from '../../../shared/errors';
import { DEFAULT_LOCAL_OBJECT_DIR, type ObjectStorageSettings } from '../../../shared/storage';

const R2_REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

/** R2 when all four R2_* variables are set; none set = local disk (dev); a partial set fails fast. */
export function readStorageConfig(): ObjectStorageSettings {
  const values = R2_REQUIRED.map((name) => readOptionalString(name));
  const set = values.filter((v) => v !== undefined).length;
  if (set > 0 && set < R2_REQUIRED.length) {
    const missing = R2_REQUIRED.filter((_, i) => values[i] === undefined);
    throw new ConfigurationError(`R2 is partially configured: missing ${missing.join(', ')}`);
  }
  const [accountId, accessKeyId, secretAccessKey, bucket] = values;
  return {
    r2: set === R2_REQUIRED.length
      ? { accountId: accountId!, accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey!, bucket: bucket!, endpoint: readOptionalString('R2_ENDPOINT') }
      : null,
    localDir: readString('OBJECT_STORAGE_DIR', DEFAULT_LOCAL_OBJECT_DIR),
  };
}
