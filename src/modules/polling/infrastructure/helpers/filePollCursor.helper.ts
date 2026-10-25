import type { PollJobName } from '../../domain';

export function cursorKey(job: PollJobName, accountIndex: number): string {
  return `${job}:${accountIndex}`;
}
