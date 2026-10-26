import { InvalidJsonError } from '../errors/body.errors';

/** Boundary: JSON.parse signals bad input only by throwing, so it is translated here once. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}
