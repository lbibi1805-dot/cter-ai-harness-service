import { PathMatcher } from '../../../../shared/http/interfaces/router.interface';
import { OpsApiPath } from '../../domain/enums/ops.enums';

export function anyOf(...paths: OpsApiPath[]): PathMatcher {
  return (pathname) => (paths.some((path) => path === pathname) ? {} : null);
}
